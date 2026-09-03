import { expect, mock, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { SimulatedClock } from 'xstate';
import { makeHungAttempt } from '../../test-utils/make-hung-attempt';
import { runBoundedAttempts } from './run-bounded-attempts';

test('it aborts a retryable call at 2s, then at 6s, and delivers the third attempt', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const clock = new SimulatedClock();

  const hang = makeHungAttempt();
  let callCount = 0;

  const sendAttempt = mock((signal: AbortSignal) => {
    callCount += 1;

    return callCount === 3 ? Promise.resolve(new Response(null, { status: 200 })) : hang(signal);
  });

  const pending = runBoundedAttempts(
    { clock, retryable: true, service: 'user', signal: new AbortController().signal },
    sendAttempt,
  );

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledTimes(1);
  });

  clock.increment(1999);

  const [first] = sendAttempt.mock.calls;

  invariant(first);

  expect(first[0].aborted).toBeFalse();

  clock.increment(1);

  expect(first[0].aborted).toBeTrue();

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledTimes(2);
  });

  clock.increment(5999);

  const [, second] = sendAttempt.mock.calls;

  invariant(second);

  expect(second[0].aborted).toBeFalse();

  clock.increment(1);

  const outcome = await pending;

  invariant(outcome.kind === 'delivered');

  expect(outcome.response.status).toBe(200);
  expect(second[0].aborted).toBeTrue();
  expect(sendAttempt).toHaveBeenCalledTimes(3);

  const retries = await inMemoryMetrics.readCounterValue('vers.web.service_call_retries');

  expect(retries).toBe(2);
});

test('it fails under the timeout reason once the third bound elapses', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const clock = new SimulatedClock();

  const sendAttempt = mock(makeHungAttempt());

  const pending = runBoundedAttempts(
    { clock, retryable: true, service: 'user', signal: new AbortController().signal },
    sendAttempt,
  );

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledTimes(1);
  });

  clock.increment(2000);

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledTimes(2);
  });

  clock.increment(6000);

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledTimes(3);
  });

  clock.increment(16_000);

  const outcome = await pending;

  invariant(outcome.kind === 'failed');

  expect(outcome.reason).toBe('timeout');
  expect(outcome.cause).toMatchObject({ name: 'AbortError' });

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.web.service_call_failures');

  expect(dataPoints).toStrictEqual([
    { attributes: { reason: 'timeout', service: 'user' }, value: 1 },
  ]);
});

test('it gives a non-retryable call one attempt bounded at the whole retryable budget', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const clock = new SimulatedClock();

  const sendAttempt = mock(makeHungAttempt());

  const pending = runBoundedAttempts(
    { clock, retryable: false, service: 'session', signal: new AbortController().signal },
    sendAttempt,
  );

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledOnce();
  });

  clock.increment(23_999);

  const [first] = sendAttempt.mock.calls;

  invariant(first);

  expect(first[0].aborted).toBeFalse();

  clock.increment(1);

  const outcome = await pending;

  invariant(outcome.kind === 'failed');

  expect(outcome.reason).toBe('timeout');
  expect(outcome.cause).toMatchObject({ name: 'AbortError' });
  expect(sendAttempt).toHaveBeenCalledOnce();

  const retries = await inMemoryMetrics.readCounterValue('vers.web.service_call_retries');

  expect(retries).toBeUndefined();
});

test('it fails under the transport reason when every attempt throws before its bound', async () => {
  const inMemoryMetrics = createInMemoryMetrics();
  const sendAttempt = mock((): Promise<Response> => Promise.reject(new Error('socket hang up')));

  const outcome = await runBoundedAttempts(
    {
      clock: new SimulatedClock(),
      retryable: true,
      service: 'avatar',
      signal: new AbortController().signal,
    },
    sendAttempt,
  );

  expect(outcome).toStrictEqual({ cause: expect.any(Error), kind: 'failed', reason: 'transport' });
  expect(sendAttempt).toHaveBeenCalledTimes(3);

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.web.service_call_failures');

  expect(dataPoints).toStrictEqual([
    { attributes: { reason: 'transport', service: 'avatar' }, value: 1 },
  ]);
});

test('it reports an abort by the caller without a further attempt', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  const clock = new SimulatedClock();
  const controller = new AbortController();

  const sendAttempt = mock(makeHungAttempt());

  const pending = runBoundedAttempts(
    { clock, retryable: true, service: 'user', signal: controller.signal },
    sendAttempt,
  );

  await waitFor(() => {
    expect(sendAttempt).toHaveBeenCalledOnce();
  });

  controller.abort();

  const outcome = await pending;

  invariant(outcome.kind === 'aborted');

  expect(outcome.cause).toMatchObject({ name: 'AbortError' });
  expect(sendAttempt).toHaveBeenCalledOnce();

  const failures = await inMemoryMetrics.readCounterValue('vers.web.service_call_failures');

  expect(failures).toBeUndefined();
});

test('it retries a retryable call answered with a 5xx and delivers the following answer', async () => {
  let callCount = 0;

  const sendAttempt = mock((): Promise<Response> => {
    callCount += 1;

    return Promise.resolve(new Response(null, { status: callCount === 1 ? 503 : 200 }));
  });

  const outcome = await runBoundedAttempts(
    {
      clock: new SimulatedClock(),
      retryable: true,
      service: 'user',
      signal: new AbortController().signal,
    },
    sendAttempt,
  );

  invariant(outcome.kind === 'delivered');

  expect(outcome.response.status).toBe(200);
  expect(sendAttempt).toHaveBeenCalledTimes(2);
});

test('it delivers the last 5xx answer once the retryable budget is spent', async () => {
  const sendAttempt = mock(
    (): Promise<Response> => Promise.resolve(new Response(null, { status: 502 })),
  );

  const outcome = await runBoundedAttempts(
    {
      clock: new SimulatedClock(),
      retryable: true,
      service: 'user',
      signal: new AbortController().signal,
    },
    sendAttempt,
  );

  invariant(outcome.kind === 'delivered');

  expect(outcome.response.status).toBe(502);
  expect(sendAttempt).toHaveBeenCalledTimes(3);
});

test('it delivers a 5xx answer to a non-retryable call without a second attempt', async () => {
  const sendAttempt = mock(
    (): Promise<Response> => Promise.resolve(new Response(null, { status: 503 })),
  );

  const outcome = await runBoundedAttempts(
    {
      clock: new SimulatedClock(),
      retryable: false,
      service: 'user',
      signal: new AbortController().signal,
    },
    sendAttempt,
  );

  invariant(outcome.kind === 'delivered');

  expect(outcome.response.status).toBe(503);
  expect(sendAttempt).toHaveBeenCalledOnce();
});

test('it delivers a 4xx answer at once and disarms its bound', async () => {
  const clock = new SimulatedClock();

  const sendAttempt = mock(
    (_signal: AbortSignal): Promise<Response> =>
      Promise.resolve(new Response(null, { status: 404 })),
  );

  const outcome = await runBoundedAttempts(
    { clock, retryable: true, service: 'user', signal: new AbortController().signal },
    sendAttempt,
  );

  clock.increment(30_000);

  const [first] = sendAttempt.mock.calls;

  invariant(first);
  invariant(outcome.kind === 'delivered');

  expect(outcome.response.status).toBe(404);
  expect(first[0].aborted).toBeFalse();
  expect(sendAttempt).toHaveBeenCalledOnce();
});

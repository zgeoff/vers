import { expect, mock, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, delay, http } from 'msw';
import { SimulatedClock } from 'xstate';
import { server } from '../../mocks/node';
import { makeBoundedFetch } from './make-bounded-fetch';

test('it aborts a hung mutation at the single-attempt bound and reports SERVICE_UNAVAILABLE', async () => {
  const clock = new SimulatedClock();

  const resolver = mock<HttpResponseResolver>(async () => {
    await delay('infinite');

    return HttpResponse.json({});
  });

  server.use(http.post('http://bounded.test/rpc/proc', resolver));

  const boundedFetch = makeBoundedFetch({ clock, isRetryable: () => false, service: 'avatar' });

  const pending = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST' }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  await waitFor(() => {
    expect(resolver).toHaveBeenCalledOnce();
  });

  clock.increment(24_000);

  expect(pending).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

  await expect(pending).toReject();

  expect(resolver).toHaveBeenCalledOnce();
});

test('it resends a retryable call with its body intact after the first attempt is aborted', async () => {
  const clock = new SimulatedClock();

  const bodies: Array<string> = [];

  const resolver = mock<HttpResponseResolver>(async (args) => {
    const body = await args.request.text();

    bodies.push(body);

    if (bodies.length === 1) {
      await delay('infinite');
    }

    return HttpResponse.json({});
  });

  server.use(http.post('http://bounded.test/rpc/proc', resolver));

  const boundedFetch = makeBoundedFetch({ clock, isRetryable: () => true, service: 'avatar' });

  const pending = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { body: '{"json":{}}', method: 'POST' }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  await waitFor(() => {
    expect(resolver).toHaveBeenCalledOnce();
  });

  clock.increment(2000);

  const response = await pending;

  expect(response.status).toBe(200);
  expect(bodies).toStrictEqual(['{"json":{}}', '{"json":{}}']);
});

test("it rethrows a caller's own abort instead of converting it to SERVICE_UNAVAILABLE", async () => {
  server.use(
    http.post('http://bounded.test/rpc/proc', async () => {
      await delay('infinite');

      return HttpResponse.json({});
    }),
  );

  const controller = new AbortController();

  controller.abort();

  const boundedFetch = makeBoundedFetch({
    clock: new SimulatedClock(),
    isRetryable: () => true,
    service: 'avatar',
  });

  const pending = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST', signal: controller.signal }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(pending).rejects.toMatchObject({ name: 'AbortError' });

  await expect(pending).toReject();
});

import { expect, mock, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, delay, http } from 'msw';
import { server } from '../../mocks/node';
import { makeBoundedFetch } from './make-bounded-fetch';

test('it aborts a hung upstream at its bound and surfaces SERVICE_UNAVAILABLE', () => {
  server.use(
    http.post('http://bounded.test/rpc/proc', async () => {
      await delay('infinite');

      return HttpResponse.json({});
    }),
  );

  const boundedFetch = makeBoundedFetch({
    attemptTimeoutsMs: [20],
    isRetryable: () => false,
    service: 'avatar',
  });

  const promise = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST' }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(promise).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});

test('it returns the successful response for a retryable procedure after a hang-then-succeed sequence', async () => {
  let callCount = 0;

  server.use(
    http.post('http://bounded.test/rpc/proc', async () => {
      callCount += 1;

      if (callCount === 1) {
        await delay('infinite');
      }

      return HttpResponse.json({ ok: true });
    }),
  );

  const boundedFetch = makeBoundedFetch({
    attemptTimeoutsMs: [20, 1000],
    isRetryable: () => true,
    retryBackoffMs: 1,
    service: 'avatar',
  });

  const response = await boundedFetch(
    new Request('http://bounded.test/rpc/proc', {
      body: JSON.stringify({ json: {} }),
      method: 'POST',
    }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(response.status).toBe(200);
  expect(response.json()).resolves.toStrictEqual({ ok: true });
});

test('it does not retry a hang-then-succeed sequence for a non-retryable procedure', async () => {
  const resolver = mock<HttpResponseResolver>(async () => {
    await delay('infinite');

    return HttpResponse.json({ ok: true });
  });

  server.use(http.post('http://bounded.test/rpc/proc', resolver));

  const boundedFetch = makeBoundedFetch({
    attemptTimeoutsMs: [20],
    isRetryable: () => false,
    service: 'avatar',
  });

  const promise = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST' }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(promise).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

  await waitFor(() => {
    expect(resolver).toHaveBeenCalledOnce();
  });
});

test("it rethrows a caller's own abort instead of converting it to SERVICE_UNAVAILABLE", () => {
  server.use(
    http.post('http://bounded.test/rpc/proc', async () => {
      await delay('infinite');

      return HttpResponse.json({});
    }),
  );

  const controller = new AbortController();

  controller.abort();

  const boundedFetch = makeBoundedFetch({
    attemptTimeoutsMs: [2000, 6000],
    isRetryable: () => true,
    service: 'avatar',
  });

  const promise = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST', signal: controller.signal }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});

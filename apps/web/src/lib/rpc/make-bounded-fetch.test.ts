import { expect, test } from 'bun:test';
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

  const boundedFetch = makeBoundedFetch({ attemptTimeoutMs: 20, service: 'avatar' });

  const promise = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST' }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(promise).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
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

  const boundedFetch = makeBoundedFetch({ service: 'avatar' });

  const promise = boundedFetch(
    new Request('http://bounded.test/rpc/proc', { method: 'POST', signal: controller.signal }),
    {},
    { context: {} },
    ['proc'],
    undefined,
  );

  expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});

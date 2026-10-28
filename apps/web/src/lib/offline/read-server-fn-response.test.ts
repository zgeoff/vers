import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/node';
import { NetworkFailureError } from './network-failure-error';
import { readServerFnResponse } from './read-server-fn-response';

test('it passes the server response through, an error status included', async () => {
  server.use(
    http.get('http://app.test/_serverFn/flags', () => new HttpResponse(null, { status: 500 })),
  );

  const response = await readServerFnResponse('http://app.test/_serverFn/flags');

  expect(response.status).toBe(500);
});

test('it marks a request that never reached the server as a network failure', () => {
  server.use(http.get('http://app.test/_serverFn/flags', () => HttpResponse.error()));

  expect(readServerFnResponse('http://app.test/_serverFn/flags')).rejects.toBeInstanceOf(
    NetworkFailureError,
  );
});

test('it keeps an aborted request an abort', () => {
  server.use(http.get('http://app.test/_serverFn/flags', () => HttpResponse.json({})));

  expect(
    readServerFnResponse('http://app.test/_serverFn/flags', { signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});

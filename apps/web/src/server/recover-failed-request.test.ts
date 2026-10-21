import { expect, test } from 'bun:test';
import { recoverFailedRequest } from './recover-failed-request';

test('it answers a request whose handler rejects with an empty 500', async () => {
  const response = await recoverFailedRequest(new Request('https://example.test/_serverFn/a'), () =>
    Promise.reject(new Error('aborted')),
  );

  expect(response.status).toBe(500);
  expect(response.text()).resolves.toBe('');
});

test('it passes through the response of a handler that resolves', async () => {
  const response = await recoverFailedRequest(new Request('https://example.test/login'), () =>
    Promise.resolve(new Response('login page')),
  );

  expect(response.text()).resolves.toBe('login page');
});

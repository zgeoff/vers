import { expect, test } from 'bun:test';
import { redirectToHTTPS } from './redirect-to-https';

test('it redirects a request forwarded over plain http to https', async () => {
  const request = new Request('http://example.test/account', {
    headers: { 'x-forwarded-proto': 'http' },
  });

  const response = await redirectToHTTPS(request, () =>
    Promise.resolve(new Response('unreachable')),
  );

  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://example.test/account');
});

test('it passes through a request already forwarded over https', async () => {
  const request = new Request('https://example.test/account', {
    headers: { 'x-forwarded-proto': 'https' },
  });

  const response = await redirectToHTTPS(request, () =>
    Promise.resolve(new Response('account page')),
  );

  expect(response.text()).resolves.toBe('account page');
});

test('it passes through a request with no forwarded-proto header', async () => {
  const response = await redirectToHTTPS(new Request('https://example.test/account'), () =>
    Promise.resolve(new Response('account page')),
  );

  expect(response.text()).resolves.toBe('account page');
});

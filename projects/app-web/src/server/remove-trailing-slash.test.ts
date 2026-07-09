import { expect, test } from 'bun:test';
import { removeTrailingSlash } from './remove-trailing-slash';

test('it redirects a trailing-slash path to its slash-free form', async () => {
  const response = await removeTrailingSlash(new Request('https://example.test/login/'), () =>
    Promise.resolve(new Response('unreachable')),
  );

  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('https://example.test/login');
});

test('it preserves the query string when redirecting', async () => {
  const response = await removeTrailingSlash(
    new Request('https://example.test/login/?next=/account'),
    () => Promise.resolve(new Response('unreachable')),
  );

  expect(response.headers.get('location')).toBe('https://example.test/login?next=/account');
});

test('it leaves the root path alone', async () => {
  const response = await removeTrailingSlash(new Request('https://example.test/'), () =>
    Promise.resolve(new Response('root')),
  );

  expect(response.text()).resolves.toBe('root');
});

test('it passes through a path with no trailing slash', async () => {
  const response = await removeTrailingSlash(new Request('https://example.test/login'), () =>
    Promise.resolve(new Response('login page')),
  );

  expect(response.text()).resolves.toBe('login page');
});

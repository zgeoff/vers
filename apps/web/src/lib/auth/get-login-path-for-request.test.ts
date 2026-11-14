import { expect, test } from 'bun:test';
import { getLoginPathForRequest } from './get-login-path-for-request';

test('it redirects a page request back to that page', () => {
  const path = getLoginPathForRequest(new URL('https://versidle.com/respite?tab=bag'), undefined);

  expect(path).toBe('/login?redirect=%2Frespite%3Ftab%3Dbag');
});

test('it redirects a server function call back to the page that made it', () => {
  const path = getLoginPathForRequest(
    new URL('https://versidle.com/_serverFn/abc123'),
    'https://versidle.com/explore/current',
  );

  expect(path).toBe('/login?redirect=%2Fexplore%2Fcurrent');
});

test.each([
  ['no Referer', undefined],
  ['a Referer that is no URL', 'not a url'],
  ['a Referer from another origin', 'https://elsewhere.example/explore'],
  ['a Referer that is itself a server function call', 'https://versidle.com/_serverFn/def456'],
])('it sends a server function call with %s to the bare login page', (_case, referer) => {
  const path = getLoginPathForRequest(new URL('https://versidle.com/_serverFn/abc123'), referer);

  expect(path).toBe('/login');
});

import { expect, test } from 'bun:test';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect';

test('it builds a login path carrying the current page as the redirect target', () => {
  const path = getLoginPathWithRedirect({ pathname: '/account', search: '?tab=security' });

  expect(path).toBe('/login?redirect=%2Faccount%3Ftab%3Dsecurity');
});

test('it carries a bare path with no search string', () => {
  const path = getLoginPathWithRedirect({ pathname: '/nexus', search: '' });

  expect(path).toBe('/login?redirect=%2Fnexus');
});

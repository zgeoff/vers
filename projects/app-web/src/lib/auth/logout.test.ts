import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { getAuthSession } from './get-auth-session';
import { logout } from './logout';

test('it clears the auth session cookie before redirecting home by default', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: 'a', refreshToken: 'r', sessionID: 's' } } },
    async () => {
      const redirectHref = await logout()
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return { redirectHref, session: await getAuthSession() };
    },
  );

  expect(outcome.value).toStrictEqual({ redirectHref: '/', session: {} });
});

test('it redirects to a caller-supplied same-origin path', () => {
  const promise = withRequestContext({}, () => logout({ redirectTo: '/goodbye' }));

  expect(promise).rejects.toMatchObject({ options: { href: '/goodbye' } });
});

test('it falls back to the home page for an unsafe redirect target', () => {
  const promise = withRequestContext({}, () => logout({ redirectTo: '//evil.example' }));

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

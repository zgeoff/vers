import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAuthSession } from './get-auth-session';
import { runLogout } from './run-logout';

test('it clears the auth session cookie before redirecting home by default', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: 'a', refreshToken: 'r', sessionID: 's' } } },
    async () => {
      const promise = runLogout();

      await expect(promise).rejects.toMatchObject({ options: { href: '/' } });

      return getAuthSession();
    },
  );

  expect(outcome.value).toStrictEqual({});
});

test('it redirects to a caller-supplied same-origin path', () => {
  const promise = withRequestContext({}, () => runLogout({ redirectTo: '/goodbye' }));

  expect(promise).rejects.toMatchObject({ options: { href: '/goodbye' } });
});

test('it falls back to the home page for an unsafe redirect target', () => {
  const promise = withRequestContext({}, () => runLogout({ redirectTo: '//evil.example' }));

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireAuth } from './require-auth';

test('it returns the session tokens for a signed-in caller', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: { accessToken: 'access-1', refreshToken: 'refresh-1', sessionID: 'session-1' },
      },
    },
    () => requireAuth(),
  );

  expect(outcome.value).toStrictEqual({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    sessionID: 'session-1',
  });
});

test('it redirects to login with the current page as the return target for a signed-out caller', () => {
  const promise = withRequestContext({ url: 'http://localhost/account?tab=security' }, () =>
    requireAuth(),
  );

  expect(promise).rejects.toMatchObject({
    options: { href: '/login?redirect=%2Faccount%3Ftab%3Dsecurity' },
  });
});

test('it redirects to login for a session missing its refresh token', () => {
  const promise = withRequestContext(
    { cookies: { en_session: { accessToken: 'access-1', sessionID: 'session-1' } } },
    () => requireAuth(),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/login?redirect=%2F' } });
});

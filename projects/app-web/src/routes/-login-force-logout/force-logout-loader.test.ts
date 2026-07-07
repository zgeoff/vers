import { expect, test } from 'bun:test';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { forceLogoutLoader } from './force-logout-loader';

test('it resolves when a pending force-logout is present', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_verification: {
          'loginLogout#email': 'x@vers.test',
          'loginLogout#sessionID': 'session-1',
        },
      },
    },
    () => forceLogoutLoader(),
  );

  expect(outcome.value).toBeUndefined();
});

test('it redirects to login when there is no pending force-logout', () => {
  const promise = withRequestContext({}, () => forceLogoutLoader());

  expect(promise).rejects.toMatchObject({ options: { href: '/login' } });
});

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    forceLogoutLoader(),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

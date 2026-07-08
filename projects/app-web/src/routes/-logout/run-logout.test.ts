import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runLogout } from './run-logout';

test('it clears the auth session and returns a redirect-home response', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: 'a', refreshToken: 'r', sessionID: 's' } } },
    () => runLogout(),
  );

  expect(outcome.value.status).toBeWithin(300, 400);
  expect(outcome.value.headers.get('location')).toBe('/');
  expect(outcome.cookies['en_session']).toBeUndefined();
});

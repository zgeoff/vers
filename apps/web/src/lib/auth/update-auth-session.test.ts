import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAuthSession } from './get-auth-session';
import { updateAuthSession } from './update-auth-session';

test('it stores the tokens and target expiry from the first commit', async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  const outcome = await withRequestContext({}, async () => {
    await updateAuthSession(
      { accessToken: 'access-1', refreshToken: 'refresh-1', sessionID: 'session-1' },
      { expiresAt },
    );

    return getAuthSession();
  });

  expect(outcome.value).toStrictEqual({
    accessToken: 'access-1',
    expires: expiresAt.toISOString(),
    refreshToken: 'refresh-1',
    sessionID: 'session-1',
  });
});

test('it keeps the original expiry across a later commit that sets no expiry itself', async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  const outcome = await withRequestContext({}, async () => {
    await updateAuthSession(
      { accessToken: 'access-1', refreshToken: 'refresh-1', sessionID: 'session-1' },
      { expiresAt },
    );

    return updateAuthSession({ accessToken: 'access-2' });
  });

  expect(outcome.value.expires).toBe(expiresAt.toISOString());
  expect(outcome.value.accessToken).toBe('access-2');
});

test('it lets a later commit move the expiry forward, as a rememberMe upgrade would', async () => {
  const firstExpiresAt = new Date(Date.now() + 60_000);
  const secondExpiresAt = new Date(Date.now() + 120_000);

  const outcome = await withRequestContext({}, async () => {
    await updateAuthSession({ sessionID: 'session-1' }, { expiresAt: firstExpiresAt });

    return updateAuthSession({}, { expiresAt: secondExpiresAt });
  });

  expect(outcome.value.expires).toBe(secondExpiresAt.toISOString());
});

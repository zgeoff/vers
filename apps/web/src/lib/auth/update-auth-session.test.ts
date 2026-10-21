import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { readAuthSession } from './read-auth-session';
import { updateAuthSession } from './update-auth-session';

test('it stores the tokens and target expiry from the first commit', async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  const outcome = await withRequestContext({}, async () => {
    await updateAuthSession(
      { accessToken: 'access-1', refreshToken: 'refresh-1', sessionID: 'session-1' },
      { expiresAt },
    );

    return readAuthSession();
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

test('it destroys the session instead of saving it once its stored expiry has passed', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: 'access-1',
          expires: new Date(Date.now() - 1000).toISOString(),
          sessionID: 'session-1',
        },
      },
    },
    () => updateAuthSession({ accessToken: 'access-2' }),
  );

  expect(outcome.value).toStrictEqual({});
  expect(outcome.cookies['en_session']).toBeUndefined();
});

test('it sets the cookie lifetime from the time left until the expiry', async () => {
  const expiresAt = new Date(Date.now() + 3_600_000);

  const outcome = await withRequestContext({}, () =>
    updateAuthSession({ sessionID: 'session-1' }, { expiresAt }),
  );

  // iron-session sets Max-Age 60 seconds short of the seal's ttl
  expect(outcome.setCookies.get('en_session')?.options?.maxAge).toBeWithin(3538, 3541);
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

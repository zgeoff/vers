import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { readAuthSession } from './read-auth-session';

test('it reads the session data out of the sealed session cookie', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { sessionID: 'session-1', userID: 'user-1' } } },
    () => readAuthSession(),
  );

  expect(outcome.value).toStrictEqual({ sessionID: 'session-1', userID: 'user-1' });
});

test('it reads a cookie in the older nested session shape as signed out', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          createdAt: 1_700_000_000_000,
          data: { sessionID: 'session-1', userID: 'user-1' },
          id: 'legacy-1',
        },
      },
    },
    () => readAuthSession(),
  );

  expect(outcome.value).toStrictEqual({});
});

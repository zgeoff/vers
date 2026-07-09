import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { createMockAccessToken } from '../../mocks/create-mock-access-token';
import * as db from '../../mocks/db';
import { withRequestContext } from '../../test-utils/with-request-context';
import { resolveSessionActor } from './resolve-session-actor';

test('it returns null with no network call when there is no cookie session', async () => {
  const outcome = await withRequestContext({}, () => resolveSessionActor());

  expect(outcome.value).toBeNull();
});

test('it returns the cookie userID unchanged for a fresh access token', async () => {
  const userID = createId();

  const accessToken = await createMockAccessToken(userID);

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: { accessToken, refreshToken: 'refresh-1', sessionID: 'session-1', userID },
      },
    },
    () => resolveSessionActor(),
  );

  expect(outcome.value).toBe(userID);
  expect(outcome.cookies['en_session']).toContainEntry(['accessToken', accessToken]);
});

test('it refreshes a stale access token once, updates the cookie, and returns the acting user', async () => {
  const session = await db.sessionCollection.create({ refreshToken: 'refresh-1' });
  const staleAccessToken = await createMockAccessToken(session.userID, '-1s');

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: staleAccessToken,
          refreshToken: 'refresh-1',
          sessionID: session.id,
          userID: session.userID,
        },
      },
    },
    () => resolveSessionActor(),
  );

  expect(outcome.value).toBe(session.userID);
  expect(outcome.cookies['en_session']).not.toContainEntry(['accessToken', staleAccessToken]);
  expect(outcome.cookies['en_session']).not.toContainEntry(['refreshToken', 'refresh-1']);
});

test('it clears the cookie and returns null when the refresh itself fails', async () => {
  const staleAccessToken = await createMockAccessToken('some-user', '-1s');

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: staleAccessToken,
          refreshToken: 'refresh-1',
          sessionID: 'session-with-no-matching-row',
          userID: 'some-user',
        },
      },
    },
    () => resolveSessionActor(),
  );

  expect(outcome.value).toBeNull();
  expect(outcome.cookies['en_session']).toBeUndefined();
});

test('it single-flights concurrent refreshes for the same session', async () => {
  const session = await db.sessionCollection.create({ refreshToken: 'refresh-1' });
  const staleAccessToken = await createMockAccessToken(session.userID, '-1s');

  const cookies = {
    en_session: {
      accessToken: staleAccessToken,
      refreshToken: 'refresh-1',
      sessionID: session.id,
      userID: session.userID,
    },
  };

  const outcome = await withRequestContext({ cookies }, () =>
    Promise.all([resolveSessionActor(), resolveSessionActor()]),
  );

  expect(outcome.value).toStrictEqual([session.userID, session.userID]);

  // if the two calls raced instead of sharing one refresh, the mock service's reuse detection
  // would revoke the session on the second rotation
  expect(db.sessionCollection.findFirst((q) => q.where({ id: session.id }))).toMatchObject({
    previousRefreshToken: 'refresh-1',
  });
});

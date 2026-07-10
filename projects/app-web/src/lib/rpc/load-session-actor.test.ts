import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { sessionContract } from '@vers/contract-session';
import { createMockAccessToken } from '../../mocks/create-mock-access-token';
import * as db from '../../mocks/db';
import { server } from '../../mocks/node';
import { resolveSessionContext } from '../../mocks/resolve-session-context';
import { withRequestContext } from '../../test-utils/with-request-context';
import { loadSessionActor } from './load-session-actor';
import { SERVICE_URLS } from './service-urls';

test('it returns null with no network call when there is no cookie session', async () => {
  const outcome = await withRequestContext({}, () => loadSessionActor());

  expect(outcome.value).toBeNull();
});

test('it returns the cookie userID unchanged for a fresh access token whose session still exists', async () => {
  const session = await db.sessionCollection.create({});
  const accessToken = await createMockAccessToken(session.userID);

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken,
          refreshToken: 'refresh-1',
          sessionID: session.id,
          userID: session.userID,
        },
      },
    },
    () => loadSessionActor(),
  );

  expect(outcome.value).toBe(session.userID);
  expect(outcome.cookies['en_session']).toContainEntry(['accessToken', accessToken]);
});

test('it clears the cookie and returns null for a fresh access token whose session no longer exists', async () => {
  const userID = createId();

  const accessToken = await createMockAccessToken(userID);

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken,
          refreshToken: 'refresh-1',
          sessionID: 'evicted-session',
          userID,
        },
      },
    },
    () => loadSessionActor(),
  );

  expect(outcome.value).toBeNull();
  expect(outcome.cookies['en_session']).toBeUndefined();
});

test('it hits getSession at most once per request for a fresh access token', async () => {
  const session = await db.sessionCollection.create({});
  const accessToken = await createMockAccessToken(session.userID);

  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
  });

  let callCount = 0;

  server.use(
    mockSession.getSession.handler(() => {
      callCount += 1;

      return session;
    }),
  );

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken,
          refreshToken: 'refresh-1',
          sessionID: session.id,
          userID: session.userID,
        },
      },
    },
    () => Promise.all([loadSessionActor(), loadSessionActor()]),
  );

  expect(outcome.value).toStrictEqual([session.userID, session.userID]);
  expect(callCount).toBe(1);
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
    () => loadSessionActor(),
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
    () => loadSessionActor(),
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
    Promise.all([loadSessionActor(), loadSessionActor()]),
  );

  expect(outcome.value).toStrictEqual([session.userID, session.userID]);

  // if the two calls raced instead of sharing one refresh, the mock service's reuse detection
  // would revoke the session on the second rotation
  expect(db.sessionCollection.findFirst((q) => q.where({ id: session.id }))).toMatchObject({
    previousRefreshToken: 'refresh-1',
  });
});

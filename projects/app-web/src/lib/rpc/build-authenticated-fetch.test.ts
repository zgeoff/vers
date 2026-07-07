import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { HttpResponse, http } from 'msw';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { server } from '../../../mocks/node';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { buildAuthenticatedFetch } from './build-authenticated-fetch';

test('it retries a 401 with the refreshed access token and the original body intact', async () => {
  const session = await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: createId(),
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: 'refresh-1',
    updatedAt: new Date(),
    userID: createId(),
    verified: true,
  });

  const probeUrl = 'http://localhost:3999/probe';

  const retried: { authorization: string | null; body: unknown } = {
    authorization: null,
    body: null,
  };

  server.use(
    http.post(probeUrl, () => HttpResponse.json({}, { status: 401 }), { once: true }),
    http.post(probeUrl, async (info) => {
      retried.authorization = info.request.headers.get('authorization');
      retried.body = await info.request.json();

      return HttpResponse.json({ ok: true });
    }),
  );

  const authenticatedFetch = buildAuthenticatedFetch();

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: 'stale-access-token',
          refreshToken: 'refresh-1',
          sessionID: session.id,
        },
      },
    },
    () =>
      authenticatedFetch(
        new Request(probeUrl, {
          body: JSON.stringify({ hello: 'world' }),
          headers: {
            authorization: 'Bearer stale-access-token',
            'content-type': 'application/json',
          },
          method: 'POST',
        }),
        {},
      ),
  );

  expect(outcome.value.status).toBe(200);
  expect(retried.authorization).toBe(`Bearer ${session.id}`);
  expect(retried.body).toStrictEqual({ hello: 'world' });
  expect(outcome.cookies['en_session']).toContainEntry(['accessToken', session.id]);
});

test('it clears the session and returns the original 401 when the refresh itself fails', async () => {
  const probeUrl = 'http://localhost:3999/probe-refresh-failure';

  server.use(http.post(probeUrl, () => HttpResponse.json({}, { status: 401 })));

  const authenticatedFetch = buildAuthenticatedFetch();

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: 'stale-access-token',
          refreshToken: 'refresh-1',
          sessionID: 'session-with-no-matching-row',
        },
      },
    },
    () => authenticatedFetch(new Request(probeUrl, { method: 'POST' }), {}),
  );

  expect(outcome.value.status).toBe(401);
  expect(outcome.cookies['en_session']).toBeUndefined();
});

test('it returns the original 401 without attempting a refresh when there is no cookie session', async () => {
  const probeUrl = 'http://localhost:3999/probe-no-session';
  let requestCount = 0;

  server.use(
    http.post(probeUrl, () => {
      requestCount += 1;

      return HttpResponse.json({}, { status: 401 });
    }),
  );

  const authenticatedFetch = buildAuthenticatedFetch();

  const outcome = await withRequestContext({}, () =>
    authenticatedFetch(new Request(probeUrl, { method: 'POST' }), {}),
  );

  expect(outcome.value.status).toBe(401);
  expect(requestCount).toBe(1);
});

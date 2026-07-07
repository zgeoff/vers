import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import * as db from '../../mocks/db';
import { server } from '../../mocks/node';
import { withRequestContext } from '../../test-utils/with-request-context';
import { buildAuthenticatedFetch } from './build-authenticated-fetch';
import { SERVICE_URLS } from './service-urls';

test('it retries a 401 with the refreshed access token and the original body intact', async () => {
  const session = await db.sessionCollection.create({ refreshToken: 'refresh-1' });

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

test('it single-flights concurrent refreshes for the same session', async () => {
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

  const probeUrlA = 'http://localhost:3999/probe-concurrent-a';
  const probeUrlB = 'http://localhost:3999/probe-concurrent-b';

  const retriedAuthorization: Array<string | null> = [];

  server.use(
    http.post(probeUrlA, () => HttpResponse.json({}, { status: 401 }), { once: true }),
    http.post(probeUrlA, (info) => {
      retriedAuthorization.push(info.request.headers.get('authorization'));

      return HttpResponse.json({ ok: 'a' });
    }),
    http.post(probeUrlB, () => HttpResponse.json({}, { status: 401 }), { once: true }),
    http.post(probeUrlB, (info) => {
      retriedAuthorization.push(info.request.headers.get('authorization'));

      return HttpResponse.json({ ok: 'b' });
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
      Promise.all([
        authenticatedFetch(new Request(probeUrlA, { method: 'POST' }), {}),
        authenticatedFetch(new Request(probeUrlB, { method: 'POST' }), {}),
      ]),
  );

  const [responseA, responseB] = outcome.value;

  // if the refresh raced instead of single-flighting, the mock service's reuse detection would
  // fail the second refresh, so its 401 retry would carry the original stale access token
  expect(responseA.status).toBe(200);
  expect(responseB.status).toBe(200);

  expect(retriedAuthorization).toIncludeAllMembers([
    `Bearer ${session.id}`,
    `Bearer ${session.id}`,
  ]);

  expect(sessionCollection.findFirst((q) => q.where({ id: session.id }))).toMatchObject({
    previousRefreshToken: 'refresh-1',
  });
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

test('it returns the original 401 without recursing when the refresh endpoint itself 401s', async () => {
  const probeUrl = 'http://localhost:3999/probe-refresh-401';
  let refreshCount = 0;

  server.use(
    http.post(probeUrl, () => HttpResponse.json({}, { status: 401 })),
    http.post(`${SERVICE_URLS.session}/rpc/refreshTokens`, () => {
      refreshCount += 1;

      return HttpResponse.json({}, { status: 401 });
    }),
  );

  const authenticatedFetch = buildAuthenticatedFetch();

  const outcome = await withRequestContext(
    {
      cookies: {
        en_session: {
          accessToken: 'stale-access-token',
          refreshToken: 'refresh-1',
          sessionID: 'session-1',
        },
      },
    },
    () => authenticatedFetch(new Request(probeUrl, { method: 'POST' }), {}),
  );

  expect(outcome.value.status).toBe(401);
  expect(refreshCount).toBe(1);
  expect(outcome.cookies['en_session']).toBeUndefined();
});

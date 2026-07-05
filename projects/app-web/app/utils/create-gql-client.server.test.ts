import { gql } from '@urql/core';
import { HttpResponse, graphql, http } from 'msw';
import { expect, test, vi } from 'vitest';
import { db } from '../mocks/db';
import { server } from '../mocks/node';
import { authSessionStorage } from '../session/auth-session-storage.server';
import { verifySessionStorage } from '../session/verify-session-storage.server';
import { createGQLClient } from './create-gql-client.server';

let setCookieHeader: null | string = null;

const _Response = globalThis.Response;

// stub the global Response object so we can capture the cookie header
vi.stubGlobal(
  'Response',
  vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
    if (init?.headers instanceof Headers) {
      setCookieHeader = init.headers.get('set-cookie');
    }

    return new _Response(body, init);
  }),
);

test('it attaches the session ID and the access token to the request', async () => {
  server.use(
    graphql.query('TestQuery', (opts) => {
      const sessionID = opts.request.headers.get('x-session-id');
      const authHeader = opts.request.headers.get('authorization');
      const accessToken = authHeader?.split(' ')[1];

      return HttpResponse.json({
        data: {
          test: {
            accessToken,
            sessionID,
          },
        },
      });
    }),
  );

  const request = new Request('http://localhost:3000/login');

  const authSession = await authSessionStorage.getSession();

  authSession.set('accessToken', 'test_access_token');
  authSession.set('sessionID', 'test_session_id');

  const cookieHeader = await authSessionStorage.commitSession(authSession);

  request.headers.set('cookie', cookieHeader);

  const TestQuery = gql /* GraphQL */ `
    query TestQuery {
      test {
        accessToken
        sessionID
      }
    }
  `;

  const client = await createGQLClient(request);

  const result = await client.query(TestQuery, {});

  expect(result.data).toStrictEqual({
    test: {
      accessToken: 'test_access_token',
      sessionID: 'test_session_id',
    },
  });
});

test('it attaches the unverified session ID to the request if the session ID is not set', async () => {
  server.use(
    graphql.query('TestQuery', (opts) => {
      const sessionID = opts.request.headers.get('x-session-id');

      return HttpResponse.json({
        data: {
          test: { sessionID },
        },
      });
    }),
  );

  const request = new Request('http://localhost:3000/login');

  const verifySession = await verifySessionStorage.getSession();

  verifySession.set('login2FA#sessionID', 'test_unverified_session_id');

  const cookieHeader = await verifySessionStorage.commitSession(verifySession);

  request.headers.set('cookie', cookieHeader);

  const TestQuery = gql /* GraphQL */ `
    query TestQuery {
      test {
        sessionID
      }
    }
  `;

  const client = await createGQLClient(request);

  const result = await client.query(TestQuery, {});

  expect(result.data).toStrictEqual({
    test: { sessionID: 'test_unverified_session_id' },
  });
});

test('it refreshes the access token when receiving a 401 error and redirects to the correct path', async () => {
  // create a valid user and session so we can refresh our token
  const user = db.user.create();

  const session = db.session.create({
    refreshToken: 'test_refresh_token',
    userID: user.id,
  });

  // setup a one time handler we can use to trigger our 401 error refresh flow
  const unauthorizedHandler = http.post(
    'https://test.com/graphql',
    () => HttpResponse.json({}, { status: 401 }),
    { once: true },
  );

  server.use(unauthorizedHandler);

  const authSession = await authSessionStorage.getSession();

  authSession.set('refreshToken', session.refreshToken);
  authSession.set('sessionID', session.id);
  authSession.set('accessToken', 'old_access_token');

  const cookieHeader = await authSessionStorage.commitSession(authSession);

  // ensure we include the .data suffix so we can test that it gets removed
  const request = new Request('http://localhost:3000/nexus.data');

  // attach our initial auth session to the request
  request.headers.set('cookie', cookieHeader);

  const client = await createGQLClient(request);

  const TestQuery = gql /* GraphQL */ `
    query TestQuery {
      test
    }
  `;

  const result = await client.query(TestQuery, {});

  // assert that we've thrown a redirect back to the same route that we started on
  expect(result.error).toMatchObject({
    networkError: new Response(null, {
      headers: {
        Location: '/nexus',
      },
      status: 302,
    }),
  });

  const refreshedAuthSession = await authSessionStorage.getSession(setCookieHeader);

  const refreshedAccessToken = refreshedAuthSession.get('accessToken');

  expect(refreshedAccessToken).not.toBe('old_access_token');
});

test('it logs the user out and redirects them to the login page if they get a 401 error and have no refresh token', async () => {
  // setup a one time handler we can use to trigger our 401 error refresh flow
  const unauthorizedHandler = http.post(
    'https://test.com/graphql',
    () => HttpResponse.json({}, { status: 401 }),
    { once: true },
  );

  server.use(unauthorizedHandler);

  const request = new Request('http://localhost:3000/nexus');

  const client = await createGQLClient(request);

  const TestQuery = gql /* GraphQL */ `
    query TestQuery {
      test
    }
  `;

  const result = await client.query(TestQuery, {});

  expect(result.error).toMatchObject({
    networkError: new Response(null, {
      headers: {
        Location: '/login',
      },
      status: 302,
    }),
  });
});

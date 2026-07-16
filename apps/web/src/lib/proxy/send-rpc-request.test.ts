import { expect, mock, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { createTestAccessToken } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import * as jose from 'jose';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/node';
import { withRequestContext } from '../../test-utils/with-request-context';
import { sendRPCRequest } from './send-rpc-request';

test('it rewrites the proxied path from /api/rpc/<service> to /rpc on the service origin', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3003/rpc/getCurrentUser', resolver));

  await withRequestContext({}, () =>
    sendRPCRequest(
      new Request('http://app.test/api/rpc/user/getCurrentUser?foo=bar', { method: 'POST' }),
      'user',
    ),
  );

  expect(resolver).toHaveBeenCalledOnce();

  expect(resolver.mock.calls[0]?.[0].request.url).toBe(
    'http://localhost:3003/rpc/getCurrentUser?foo=bar',
  );
});

test('it forwards the method and body for a caller with no cookie session, minting an anonymous token', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3003/rpc/updateEmail', resolver));

  await withRequestContext({}, () =>
    sendRPCRequest(
      new Request('http://app.test/api/rpc/user/updateEmail', {
        body: JSON.stringify({ email: 'new@vers.test' }),
        headers: { authorization: 'Bearer forwarded-from-the-browser' },
        method: 'POST',
      }),
      'user',
    ),
  );

  expect(resolver).toHaveBeenCalledOnce();

  const request = resolver.mock.calls[0]?.[0].request;

  const body = await request?.text();

  const authorization = request?.headers.get('authorization') ?? '';
  const payload = jose.decodeJwt(authorization.replace('Bearer ', ''));

  expect(request?.method).toBe('POST');
  expect(payload).toMatchObject({ aud: 'service-user', iss: 'vers-edge' });
  expect(payload.sub).toBeUndefined();
  expect(body).toBe(JSON.stringify({ email: 'new@vers.test' }));
});

test('it forwards a bodyless GET request without a body', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.get('http://localhost:3003/rpc/getUser', resolver));

  const outcome = await withRequestContext({}, () =>
    sendRPCRequest(new Request('http://app.test/api/rpc/user/getUser', { method: 'GET' }), 'user'),
  );

  expect(resolver).toHaveBeenCalledOnce();
  expect(resolver.mock.calls[0]?.[0].request.method).toBe('GET');
  expect(outcome.value.status).toBe(200);
});

test("it mints an s2s token carrying the caller's cookie userID as its subject, overriding any forwarded authorization", async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));
  const userID = createId();
  const sessionID = createId();

  await db.sessionCollection.create({ id: sessionID, userID });

  const accessToken = await createTestAccessToken(userID);

  server.use(http.get('http://localhost:3005/rpc/getAvatars', resolver));

  await withRequestContext(
    {
      cookies: {
        en_session: { accessToken, refreshToken: 'refresh', sessionID, userID },
      },
    },
    () =>
      sendRPCRequest(
        new Request('http://app.test/api/rpc/avatar/getAvatars', {
          headers: { authorization: 'Bearer stale-browser-header' },
          method: 'GET',
        }),
        'avatar',
      ),
  );

  expect(resolver).toHaveBeenCalledOnce();

  const authorization = resolver.mock.calls[0]?.[0].request.headers.get('authorization') ?? '';
  const payload = jose.decodeJwt(authorization.replace('Bearer ', ''));

  expect(payload).toMatchObject({ aud: 'service-avatar', iss: 'vers-edge', sub: userID });
});

test('it returns a response whose headers the server can still modify', async () => {
  server.use(
    http.get('http://localhost:3003/rpc/getUser', () =>
      HttpResponse.json({}, { headers: { 'x-upstream': 'kept' } }),
    ),
  );

  const outcome = await withRequestContext({}, () =>
    sendRPCRequest(new Request('http://app.test/api/rpc/user/getUser', { method: 'GET' }), 'user'),
  );

  expect(outcome.value.headers.get('x-upstream')).toBe('kept');

  expect(() => {
    outcome.value.headers.delete('x-upstream');
  }).not.toThrow();
});

test('it answers an aborted request whose body is unreadable with a client-closed status', async () => {
  const controller = new AbortController();

  const request = new Request('http://app.test/api/rpc/user/updateEmail', {
    body: JSON.stringify({ email: 'new@vers.test' }),
    method: 'POST',
    signal: controller.signal,
  });

  await request.blob();

  controller.abort();

  const outcome = await withRequestContext({}, () => sendRPCRequest(request, 'user'));

  expect(outcome.value.status).toBe(499);
});

test('it rethrows a body read failure for a caller that is still connected', async () => {
  const request = new Request('http://app.test/api/rpc/user/updateEmail', {
    body: JSON.stringify({ email: 'new@vers.test' }),
    method: 'POST',
  });

  await request.blob();

  const promise = withRequestContext({}, () => sendRPCRequest(request, 'user'));

  expect(promise).rejects.toBeInstanceOf(TypeError);
});

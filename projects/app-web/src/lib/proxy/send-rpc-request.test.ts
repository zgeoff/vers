import { expect, mock, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, http } from 'msw';
import * as db from '../../mocks/db';
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

test('it forwards the method, headers, and body to the target service for a caller with no cookie session', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3003/rpc/updateEmail', resolver));

  await withRequestContext({}, () =>
    sendRPCRequest(
      new Request('http://app.test/api/rpc/user/updateEmail', {
        body: JSON.stringify({ email: 'new@vers.test' }),
        headers: { authorization: 'Bearer dev-session' },
        method: 'POST',
      }),
      'user',
    ),
  );

  expect(resolver).toHaveBeenCalledOnce();

  const request = resolver.mock.calls[0]?.[0].request;

  const body = await request?.text();

  expect(request?.method).toBe('POST');
  expect(request?.headers.get('authorization')).toBe('Bearer dev-session');
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

test('it attaches the caller own bearer header from their cookie session, overriding any forwarded one', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));
  const sessionID = createId();

  await db.sessionCollection.create({ id: sessionID, userID: createId() });

  server.use(http.get('http://localhost:3005/rpc/getAvatars', resolver));

  await withRequestContext(
    {
      cookies: {
        en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID },
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

  expect(resolver.mock.calls[0]?.[0].request.headers.get('authorization')).toBe(
    `Bearer ${sessionID}`,
  );
});

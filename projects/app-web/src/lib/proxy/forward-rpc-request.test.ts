import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../../../mocks/node';
import { forwardRPCRequest } from './forward-rpc-request';

test('it rewrites the proxied path from /api/rpc/<service> to /rpc on the service origin', async () => {
  let capturedURL = '';

  server.use(
    http.post('http://localhost:3003/rpc/getCurrentUser', (info) => {
      capturedURL = info.request.url;

      return HttpResponse.json({});
    }),
  );

  await forwardRPCRequest(
    new Request('http://app.test/api/rpc/user/getCurrentUser?foo=bar', { method: 'POST' }),
    'user',
  );

  expect(capturedURL).toBe('http://localhost:3003/rpc/getCurrentUser?foo=bar');
});

test('it forwards the method, headers, and body to the target service', async () => {
  const captured: { authorization: null | string; body: string; method: string } = {
    authorization: null,
    body: '',
    method: '',
  };

  server.use(
    http.post('http://localhost:3003/rpc/updateEmail', async (info) => {
      captured.method = info.request.method;
      captured.authorization = info.request.headers.get('authorization');
      captured.body = await info.request.text();

      return HttpResponse.json({});
    }),
  );

  await forwardRPCRequest(
    new Request('http://app.test/api/rpc/user/updateEmail', {
      body: JSON.stringify({ email: 'new@vers.test' }),
      headers: { authorization: 'Bearer dev-session' },
      method: 'POST',
    }),
    'user',
  );

  expect(captured.method).toBe('POST');
  expect(captured.authorization).toBe('Bearer dev-session');
  expect(captured.body).toBe(JSON.stringify({ email: 'new@vers.test' }));
});

test('it forwards a bodyless GET request without a body', async () => {
  let capturedMethod = '';

  server.use(
    http.get('http://localhost:3003/rpc/getUser', (info) => {
      capturedMethod = info.request.method;

      return HttpResponse.json({});
    }),
  );

  const response = await forwardRPCRequest(
    new Request('http://app.test/api/rpc/user/getUser', { method: 'GET' }),
    'user',
  );

  expect(capturedMethod).toBe('GET');
  expect(response.status).toBe(200);
});

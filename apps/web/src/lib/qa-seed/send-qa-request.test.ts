import { expect, mock, test } from 'bun:test';
import * as jose from 'jose';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/node';
import { sendQARequest } from './send-qa-request';

test('it answers 404 without forwarding when no QA token is configured', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3006/rpc/createQAAccount', resolver));

  const response = await sendQARequest(
    new Request('http://app.test/api/qa/createQAAccount', {
      body: '{}',
      headers: { authorization: 'Bearer placeholder-qa-token-placeholder' },
      method: 'POST',
    }),
    { configuredToken: undefined },
  );

  expect(response.status).toBe(404);
  expect(resolver).not.toHaveBeenCalled();
});

test('it answers 401 without forwarding a request that lacks the QA token', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3006/rpc/createQAAccount', resolver));

  const response = await sendQARequest(
    new Request('http://app.test/api/qa/createQAAccount', {
      body: '{}',
      headers: { authorization: 'Bearer placeholder-wrong-token-placeholder' },
      method: 'POST',
    }),
    { configuredToken: 'placeholder-qa-token-placeholder' },
  );

  expect(response.status).toBe(401);
  expect(resolver).not.toHaveBeenCalled();
});

test('it answers 404 without forwarding when the QA token holder calls another activity procedure', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({}));

  server.use(http.post('http://localhost:3006/rpc/stopActivity', resolver));

  const response = await sendQARequest(
    new Request('http://app.test/api/qa/stopActivity', {
      body: '{}',
      headers: { authorization: 'Bearer placeholder-qa-token-placeholder' },
      method: 'POST',
    }),
    { configuredToken: 'placeholder-qa-token-placeholder' },
  );

  expect(response.status).toBe(404);
  expect(resolver).not.toHaveBeenCalled();
});

test("it forwards the QA token holder's createQAAccount call under an anonymous edge token with the QA seeding scope", async () => {
  const resolver = mock<HttpResponseResolver>(() =>
    HttpResponse.json({ json: { kind: 'created' } }, { status: 200 }),
  );

  server.use(http.post('http://localhost:3006/rpc/createQAAccount', resolver));

  const response = await sendQARequest(
    new Request('http://app.test/api/qa/createQAAccount', {
      body: JSON.stringify({ json: { level: 1, runs: 0, twoFactor: false, user: 'qa-heron' } }),
      headers: { authorization: 'Bearer placeholder-qa-token-placeholder' },
      method: 'POST',
    }),
    { configuredToken: 'placeholder-qa-token-placeholder' },
  );

  const forwarded = resolver.mock.calls[0]?.[0].request;
  const authorization = forwarded?.headers.get('authorization') ?? '';
  const claims = jose.decodeJwt(authorization.replace('Bearer ', ''));

  const responseBody: unknown = await response.json();
  const forwardedBody = await forwarded?.text();

  expect({ body: responseBody, status: response.status }).toStrictEqual({
    body: { json: { kind: 'created' } },
    status: 200,
  });

  expect(claims).toStrictEqual({
    aud: 'service-activity',
    exp: expect.any(Number),
    iss: 'app-web',
    scope: 'qa:seed',
  });

  expect(forwardedBody).toBe(
    JSON.stringify({ json: { level: 1, runs: 0, twoFactor: false, user: 'qa-heron' } }),
  );
});

import { expect, mock, test } from 'bun:test';
import type { HttpResponseResolver } from 'msw';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { makeUmamiProxy } from './make-umami-proxy';

test('it relays the tracker script from the upstream deployment', async () => {
  server.use(
    http.get('https://umami.test/script.js', () =>
      HttpResponse.text('tracker-source', { headers: { 'content-type': 'text/javascript' } }),
    ),
  );

  const proxy = makeUmamiProxy({ upstream: 'https://umami.test' });
  const next = mock(() => Promise.resolve(new Response('next')));

  const response = await proxy(new Request('http://app.test/site.js'), next);
  const body = await response.text();

  expect(next).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/javascript');
  expect(body).toBe('tracker-source');
});

test('it forwards a beacon with the client address and user agent', async () => {
  const resolver = mock<HttpResponseResolver>(() => HttpResponse.json({ cache: 'token' }));

  server.use(http.post('https://umami.test/api/send', resolver));

  const proxy = makeUmamiProxy({ upstream: 'https://umami.test' });
  const next = mock(() => Promise.resolve(new Response('next')));

  const response = await proxy(
    new Request('http://app.test/site/api/send', {
      body: JSON.stringify({ type: 'event' }),
      headers: {
        'content-type': 'application/json',
        'fly-client-ip': '203.0.113.7',
        'user-agent': 'test-browser/1.0',
      },
      method: 'POST',
    }),
    next,
  );

  expect(next).not.toHaveBeenCalled();
  expect(resolver).toHaveBeenCalledOnce();

  const upstreamRequest = resolver.mock.calls[0]?.[0].request;

  const upstreamBody = await upstreamRequest?.text();
  const responseBody: unknown = await response.json();

  expect(upstreamBody).toBe(JSON.stringify({ type: 'event' }));
  expect(upstreamRequest?.headers.get('content-type')).toBe('application/json');
  expect(upstreamRequest?.headers.get('user-agent')).toBe('test-browser/1.0');
  expect(upstreamRequest?.headers.get('x-vers-client-ip')).toBe('203.0.113.7');
  expect(responseBody).toStrictEqual({ cache: 'token' });
});

test('it defers any other request to the rest of the chain', async () => {
  const proxy = makeUmamiProxy({ upstream: 'https://umami.test' });
  const next = mock(() => Promise.resolve(new Response('next')));

  const response = await proxy(new Request('http://app.test/home'), next);
  const body = await response.text();

  expect(next).toHaveBeenCalledOnce();
  expect(body).toBe('next');
});

test('it defers the tracker paths when no upstream is configured', async () => {
  const proxy = makeUmamiProxy({ upstream: null });
  const next = mock(() => Promise.resolve(new Response('next')));

  const response = await proxy(new Request('http://app.test/site.js'), next);
  const body = await response.text();

  expect(next).toHaveBeenCalledOnce();
  expect(body).toBe('next');
});

test('it answers 502 when the upstream is unreachable', async () => {
  server.use(http.post('https://umami.test/api/send', () => HttpResponse.error()));

  const proxy = makeUmamiProxy({ upstream: 'https://umami.test' });
  const next = mock(() => Promise.resolve(new Response('next')));

  const response = await proxy(
    new Request('http://app.test/site/api/send', { body: '{}', method: 'POST' }),
    next,
  );

  expect(next).not.toHaveBeenCalled();
  expect(response.status).toBe(502);
});

import { expect, test } from 'bun:test';
import { makeRateLimiter } from './make-rate-limiter';

test('it allows requests under the default budget', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  const request = new Request('https://example.test/nexus', {
    headers: { 'fly-client-ip': '203.0.113.1' },
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(200);
});

test('it rejects a strict-route mutation once the strict budget is exhausted', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });
  const ip = '203.0.113.2';

  for (let i = 0; i < 10; i += 1) {
    const request = new Request('https://example.test/login', {
      headers: { 'fly-client-ip': ip },
      method: 'POST',
    });

    await rateLimit(request, () => Promise.resolve(new Response('ok')));
  }

  const request = new Request('https://example.test/login', {
    headers: { 'fly-client-ip': ip },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
});

test('it applies the strong (not strict) budget to a GET against a strict route', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });
  const ip = '203.0.113.3';

  for (let i = 0; i < 10; i += 1) {
    const request = new Request('https://example.test/login', {
      headers: { 'fly-client-ip': ip },
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }
});

test('it tracks each client IP independently', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  for (let i = 0; i < 10; i += 1) {
    const request = new Request('https://example.test/login', {
      headers: { 'fly-client-ip': '203.0.113.4' },
      method: 'POST',
    });

    await rateLimit(request, () => Promise.resolve(new Response('ok')));
  }

  const otherClientRequest = new Request('https://example.test/login', {
    headers: { 'fly-client-ip': '203.0.113.5' },
    method: 'POST',
  });

  const response = await rateLimit(otherClientRequest, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(200);
});

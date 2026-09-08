import { expect, test } from 'bun:test';
import { buildSealedSessionCookie } from '../test-utils/build-sealed-session-cookie';
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

test('it rejects an rpc call once the session budget of 60 per minute is spent', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-a' });

  for (let i = 0; i < 60; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.6' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.6' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
});

test('it never rejects a page-load burst followed by one flush every 10 s', async () => {
  let nowMs = 1_700_000_000_000;
  const rateLimit = makeRateLimiter({ clock: { now: () => nowMs }, maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-b' });

  for (let i = 0; i < 20; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/getLatestActivityProgress', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.7' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  for (let i = 0; i < 60; i += 1) {
    nowMs += 10_000;

    const request = new Request('https://example.test/api/rpc/activity/trackActivityProgress', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.7' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }
});

test('it tells a rejected rpc call how many seconds remain until its window resets', async () => {
  let nowMs = 1_700_000_000_000;
  const rateLimit = makeRateLimiter({ clock: { now: () => nowMs }, maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-c' });

  for (let i = 0; i < 60; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.8' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  nowMs += 20_500;

  const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.8' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('40');
});

test('it admits an rpc call again once its window has reset', async () => {
  let nowMs = 1_700_000_000_000;
  const rateLimit = makeRateLimiter({ clock: { now: () => nowMs }, maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-d' });

  for (let i = 0; i < 61; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.9' },
      method: 'POST',
    });

    await rateLimit(request, () => Promise.resolve(new Response('ok')));
  }

  nowMs += 60_000;

  const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.9' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(200);
});

test('it gives two sessions behind one client IP separate rpc budgets', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-e' });

  for (let i = 0; i < 61; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.10' },
      method: 'POST',
    });

    await rateLimit(request, () => Promise.resolve(new Response('ok')));
  }

  const otherCookie = await buildSealedSessionCookie({ sessionID: 'sess-f' });

  const otherSessionRequest = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: `en_session=${otherCookie}`, 'fly-client-ip': '203.0.113.10' },
    method: 'POST',
  });

  const response = await rateLimit(otherSessionRequest, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(200);
});

test('it keeps one rpc budget for a session whose cookie was re-sealed', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-g' });

  for (let i = 0; i < 60; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.11' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  const resealedCookie = await buildSealedSessionCookie({ sessionID: 'sess-g' });

  const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: `en_session=${resealedCookie}`, 'fly-client-ip': '203.0.113.11' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
});

test('it budgets rpc calls that carry no session cookie by client IP', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  for (let i = 0; i < 60; i += 1) {
    const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
      headers: { 'fly-client-ip': '203.0.113.12' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { 'fly-client-ip': '203.0.113.12' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
});

test('it budgets rpc calls that carry a forged session cookie by client IP', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  for (let i = 0; i < 60; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=forged-${i}`, 'fly-client-ip': '203.0.113.13' },
      method: 'POST',
    });

    const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

    expect(response.status).toBe(200);
  }

  const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
    headers: { cookie: 'en_session=forged-61', 'fly-client-ip': '203.0.113.13' },
    method: 'POST',
  });

  const response = await rateLimit(request, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(429);
});

test('it keeps the IP-keyed default budget for a page request from a session whose rpc budget is spent', async () => {
  const rateLimit = makeRateLimiter({ maxMultiple: 1 });

  const cookie = await buildSealedSessionCookie({ sessionID: 'sess-h' });

  for (let i = 0; i < 61; i += 1) {
    const request = new Request('https://example.test/api/rpc/activity/advanceActivity', {
      headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.14' },
      method: 'POST',
    });

    await rateLimit(request, () => Promise.resolve(new Response('ok')));
  }

  const pageRequest = new Request('https://example.test/nexus', {
    headers: { cookie: `en_session=${cookie}`, 'fly-client-ip': '203.0.113.14' },
  });

  const response = await rateLimit(pageRequest, () => Promise.resolve(new Response('ok')));

  expect(response.status).toBe(200);
});

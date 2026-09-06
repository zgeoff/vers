import { expect, test } from '../src/test';

test('it serves the production build health check and anonymous home page', async ({ request }) => {
  const health = await request.get('/health');

  expect(health.status()).toBe(200);

  await expect(health.json()).resolves.toStrictEqual({ ok: true });

  const root = await request.get('/');

  expect(root.status()).toBe(200);
  expect(root.headers()['content-type']).toContain('text/html');
});

test('it serves the favicon and the robots policy as static files', async ({ request }) => {
  const icon = await request.get('/favicon.ico');

  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/');

  const svgIcon = await request.get('/favicon.svg');

  expect(svgIcon.status()).toBe(200);
  expect(svgIcon.headers()['content-type']).toContain('image/svg+xml');

  const robots = await request.get('/robots.txt');

  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');

  await expect(robots.text()).resolves.toContain('User-agent: *');
});

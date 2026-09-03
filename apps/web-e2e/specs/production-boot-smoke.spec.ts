import { expect, test } from '../src/test';

test('it serves the production build health check and anonymous home page', async ({ request }) => {
  const health = await request.get('/health');

  expect(health.status()).toBe(200);

  await expect(health.json()).resolves.toStrictEqual({ ok: true });

  const root = await request.get('/');

  expect(root.status()).toBe(200);
  expect(root.headers()['content-type']).toContain('text/html');
});

import { expect, test } from '@playwright/test';

const PRODUCTION_BASE_URL = process.env['PRODUCTION_BASE_URL'] ?? 'http://localhost:3010';

/**
 * The production server hosts no mock backend, so only routes with no downstream service call
 * can be asserted here.
 */
test('it serves the production build health check and anonymous home page', async ({
  playwright,
}) => {
  const request = await playwright.request.newContext({ baseURL: PRODUCTION_BASE_URL });
  const health = await request.get('/health');

  expect(health.status()).toBe(200);

  await expect(health.json()).resolves.toStrictEqual({ ok: true });

  const root = await request.get('/');

  expect(root.status()).toBe(200);
  expect(root.headers()['content-type']).toContain('text/html');

  await request.dispose();
});

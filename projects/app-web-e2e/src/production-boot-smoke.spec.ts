import { expect, test } from '@playwright/test';

const PRODUCTION_BASE_URL = process.env['PRODUCTION_BASE_URL'] ?? 'http://localhost:3010';

/**
 * Proves the actual deployable artifact (`vite build` + `server.mjs`) boots and serves traffic —
 * distinct from the dev-server-backed journey specs, since the production build can't host the
 * mock backend plugin (see playwright.config.ts). Only routes with no downstream service call are
 * exercised here; `home-smoke.spec.ts` and `game-smoke.spec.ts` cover the rest against the mock
 * backend.
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

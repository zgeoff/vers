import { expect, test } from '@playwright/test';

/**
 * Routes visited to warm the vite dev server before the real suite runs.
 * Covers the entry points the specs start from; deeper routes behind auth
 * warm up during the first spec that reaches them (absorbed by CI retries).
 */
const WARMUP_ROUTES = ['/', '/login', '/signup', '/forgot-password'];

test('it warms the dev server until the module graph is stable', async ({
  page,
}) => {
  test.setTimeout(120 * 1000);

  // the first pass triggers vite's on-demand compile and dependency
  // discovery — any newly optimized dependency forces a full page reload
  // mid-session, which is exactly the instability that breaks real specs;
  // the second pass runs against a settled optimizer so the suite starts
  // from a stable module graph
  for (let pass = 0; pass < 2; pass++) {
    for (const route of WARMUP_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' });
    }
  }

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});

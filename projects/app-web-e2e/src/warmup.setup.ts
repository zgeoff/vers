import { expect, test } from '@playwright/test';

/**
 * Entry routes the specs start from; auth-gated routes warm up during the
 * first spec that reaches them (absorbed by CI retries).
 */
const WARMUP_ROUTES = ['/', '/login', '/signup', '/forgot-password'];

test('it warms the dev server until the module graph is stable', async (fixtures) => {
  test.setTimeout(120 * 1000);

  // the first pass triggers vite's dependency discovery (each newly
  // optimized dependency forces a full fixtures.page reload); the second runs
  // against a settled optimizer
  for (let pass = 0; pass < 2; pass++) {
    for (const route of WARMUP_ROUTES) {
      await fixtures.page.goto(route, { waitUntil: 'networkidle' });
    }
  }

  await fixtures.page.goto('/');
  await expect(fixtures.page.getByRole('link', { name: 'Login' })).toBeVisible();
});

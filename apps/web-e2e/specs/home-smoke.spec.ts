import { runLogin, runSettingsLogout } from '../src/support/journey';
import { expect, test } from '../src/support/test';

/**
 * Exercises the home route's server render against a live dev server booted against the mock
 * backend: `getRequestHeaders` and the session-aware `getCurrentUser` loader query both run for
 * real here, none of which `bun test` can drive (it resolves package exports without the
 * `react-server` condition, and there's no live request's `AsyncLocalStorage` context).
 */
test(
  'it serves the anonymous home page server-rendered',
  { tag: '@mock' },
  async ({ page, request }) => {
    const rawResponse = await request.get('/');

    expect(rawResponse.status()).toBe(200);
    expect(rawResponse.headers()['content-type']).toContain('text/html');

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome to vers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  },
);

test(
  'it serves the signed-in home page server-rendered and logs out back to anonymous',
  { tag: '@mock' },
  async ({ page }) => {
    // the demo account carries a seeded avatar, so a fresh login lands straight in the game
    // rather than the create-avatar sheet
    await runLogin(page, { email: 'demo@vers.test', password: 'password123' });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome back, Demo Account.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeHidden();

    await page.getByRole('link', { name: 'Enter game' }).click();

    await expect(page).toHaveURL(/\/respite$/);
    await runSettingsLogout(page);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  },
);

import { runLogin } from '../src/support/run-login';
import { runSettingsLogout } from '../src/support/run-settings-logout';
import { expect, test } from '../src/support/test';

/**
 * Exercises the home route against a live dev server booted against the mock backend, past what
 * `bun test` can drive (it resolves package exports without the `react-server` condition, and
 * there's no live request's `AsyncLocalStorage` context). The hero renders its content
 * client-side behind `!query.isPending`, so this checks the served HTML response (200,
 * `text/html`) and the client-rendered signed-out actions, not server-rendered content.
 */
test(
  'it serves the home page and renders the signed-out actions',
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
    await expect(page).toHaveURL(/\/respite$/);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome back, Demo Account.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeHidden();

    await page.getByRole('link', { name: 'Enter game' }).click();

    await expect(page).toHaveURL(/\/respite$/);
    await runSettingsLogout(page);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  },
);

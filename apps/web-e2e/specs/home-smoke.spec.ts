import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

/**
 * Exercises the home route against a live server, past what `bun test` can drive (it resolves
 * package exports without the `react-server` condition, and there's no live request's
 * `AsyncLocalStorage` context). The hero renders its content client-side behind `!query.isPending`,
 * so this checks the served HTML response (200, `text/html`) and the client-rendered signed-out
 * actions, not server-rendered content.
 */
test('it serves the home page and renders the signed-out actions', async ({ page, request }) => {
  const rawResponse = await request.get('/');

  expect(rawResponse.status()).toBe(200);
  expect(rawResponse.headers()['content-type']).toContain('text/html');

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to vers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
});

test('it renders the signed-in home page for a seeded account', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('demo@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome back, Demo Account.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeHidden();
});

import { expect, test } from '@playwright/test';
import { waitForHoneypotWindow } from './wait-for-honeypot-window';

/**
 * Exercises the Flight pipeline against a live dev server booted against the mock backend: the
 * session cookie/header read, `getRequestHeaders`, and the Composite Component render all run for
 * real here, none of which `bun test` can drive (it resolves package exports without the
 * `react-server` condition, and there's no live request's `AsyncLocalStorage` context).
 */
test('it serves the anonymous home page server-rendered and hydrates the session badge', async ({
  page,
  request,
}) => {
  const rawResponse = await request.get('/');
  const rawBody = await rawResponse.text();

  expect(rawBody).toContain('data-testid="home-anon"');

  await page.goto('/');

  await expect(page.getByTestId('home-anon')).toHaveText('You are not signed in.');

  await expect(page.getByTestId('session-badge')).toContainText(
    'Flight fragment: no active session.',
  );

  await expect(page.getByTestId('current-user-panel-error')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
});

test('it serves the signed-in home page server-rendered, lands at respite, and logs out back to anonymous', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an
  // earlier click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('demo@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
  await page.waitForURL(/\/respite$/);

  // the raw SSR body, read through the page's own cookie jar — the bare `request` fixture keeps a
  // separate jar and would render anonymous
  const rawResponse = await page.request.get('/');
  const rawBody = await rawResponse.text();

  expect(rawBody).toContain('data-testid="home-signed-in"');

  await page.goto('/');

  await expect(page.getByTestId('home-signed-in')).toHaveText('Welcome back, Demo Account.');

  await expect(page.getByTestId('session-badge')).toContainText(
    'Flight fragment: signed in as Demo Account.',
  );

  await expect(page.getByTestId('current-user-panel-data')).toHaveText(
    'Client-lane read: signed in as Demo Account.',
  );

  await page.getByRole('link', { name: 'Enter game' }).click();

  await expect(page).toHaveURL(/\/respite$/);

  // the game canvas's initial scene setup blocks the main thread for a variable stretch (worse
  // under parallel worker load), long enough that a click fired mid-block is silently dropped —
  // retry the click until the nav visibly opens rather than trusting a single one
  const accountLink = page.getByRole('link', { exact: true, name: 'Account' });

  await expect(async () => {
    await page.getByRole('button', { name: 'Menu' }).click();

    await expect(accountLink).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await accountLink.click();

  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

import { expect, test } from '@playwright/test';

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
});

test('it serves the signed-in home page server-rendered and hydrates the session badge', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Email').fill('demo@vers.test');
  await page.getByLabel('Password').fill('password123');

  // the honeypot rejects any submission under 1.5s old as bot-paced — real typing naturally
  // clears it, a scripted fill+click doesn't
  await page.waitForTimeout(1600);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

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
});

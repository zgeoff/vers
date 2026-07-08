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
  request,
}) => {
  await page.setExtraHTTPHeaders({ authorization: 'Bearer dev-session' });

  const rawResponse = await request.get('/', {
    headers: { authorization: 'Bearer dev-session' },
  });

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

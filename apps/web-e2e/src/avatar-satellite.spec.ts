import { expect, test } from '@playwright/test';

/**
 * `/avatar` mounts its own satellite canvas alongside the persistent world canvas: two `<canvas>`
 * elements are attached while the panel is up, and navigating away drops back to one as the
 * satellite dies with the route (`keepAlive: false`) while the tagged world canvas survives.
 */
test('it mounts a second canvas for the avatar satellite and drops it on navigation away', async ({
  page,
}) => {
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  // a zero-gap resync can open the welcome-back dialog at any point after login;
  // dismiss it whenever it would intercept an action
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Welcome back' }), (dialog) =>
    dialog.getByRole('button', { name: 'Close' }).click(),
  );

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/avatar');

  await expect(page).toHaveURL(/\/login/);

  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill('e2e-avatar-satellite@vers.test');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/avatar$/);

  const canvases = page.locator('canvas');

  await expect(canvases).toHaveCount(2);

  const worldCanvas = canvases.first();

  await worldCanvas.evaluate((element) => {
    element.dataset['canvasPersistenceTag'] = 'world';
  });

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/);
  await expect(canvases).toHaveCount(1);
  await expect(canvases.first()).toHaveAttribute('data-canvas-persistence-tag', 'world');

  expect(consoleErrors).toStrictEqual([]);
});

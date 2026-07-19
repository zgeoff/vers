import { expect, test } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

/**
 * `/avatar` mounts its own satellite canvas alongside the persistent world canvas: two `<canvas>`
 * elements are attached while the panel is up, and navigating away drops back to one as the
 * satellite dies with the route (`keepAlive: false`) while the tagged world canvas survives.
 */
test('it mounts a second canvas for the avatar satellite and drops it on navigation away', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-avatar-satellite@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  // the seeded account carries an avatar, so the active-avatar gate lands it in-game at respite
  await expect(page).toHaveURL(/\/respite$/);

  // scope the no-console-errors assertion to the satellite-canvas walk this spec is about; the
  // login that arranges the session is setup
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.getByRole('link', { exact: true, name: 'Avatar' }).click();

  await expect(page).toHaveURL(/\/avatar$/);

  const canvases = page.locator('canvas');

  await expect(canvases).toHaveCount(2);

  const worldCanvas = canvases.first();

  await worldCanvas.evaluate((element) => {
    element.dataset['canvasPersistenceTag'] = 'world';
  });

  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/);
  await expect(canvases).toHaveCount(1);
  await expect(canvases.first()).toHaveAttribute('data-canvas-persistence-tag', 'world');

  expect(consoleErrors).toStrictEqual([]);
});

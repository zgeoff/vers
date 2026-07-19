import { expect, test } from '@playwright/test';
import { waitForHoneypotWindow } from './wait-for-honeypot-window';

/**
 * The `_game` layout mounts its canvas once and never remounts it across child-route navigation:
 * a client-side nav to another game route must leave the same `<canvas>` element in the DOM,
 * carrying whatever GPU state it already uploaded.
 */
test('it keeps the same canvas element across client-side game navigation', async ({ page }) => {
  // a real login plus five client-side game navigations, each holding a mounted Three.js canvas,
  // runs well past other specs' budget under CI's shared dev server and CPU contention
  test.slow();

  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/explore');

  await expect(page).toHaveURL(/\/login/);

  // hydration gate: the login form's submit handler attaches only once React commits; an
  // earlier click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill('e2e-canvas@vers.test');
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/explore$/);

  const canvas = page.locator('canvas');

  // software-GL canvas mounts on a loaded shared runner can far outlast the suite-wide expect
  // timeout while staying sound — slow init is not a missing canvas
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await canvas.evaluate((element) => {
    element.dataset['canvasPersistenceTag'] = 'original';
  });

  for (const [linkName, urlPattern] of [
    ['Respite', /\/respite$/],
    ['Stash', /\/stash$/],
    ['Market', /\/market$/],
    ['Avatar', /\/avatar(?<create>\/create)?$/],
    ['Explore', /\/explore$/],
  ] as const) {
    await page.getByRole('link', { exact: true, name: linkName }).click();

    await expect(page).toHaveURL(urlPattern);
    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute('data-canvas-persistence-tag', 'original');
  }

  // cheap proof the view-transition wiring shipped: the canvas's nearest named ancestor still
  // carries the stable `game-canvas` group that keeps it out of the root snapshot
  const viewTransitionName = await canvas.evaluate((element) => {
    let node: Element | null = element;

    while (node !== null) {
      const name = getComputedStyle(node).viewTransitionName;

      if (name !== 'none') {
        return name;
      }

      node = node.parentElement;
    }

    return null;
  });

  expect(viewTransitionName).toBe('game-canvas');
  expect(consoleErrors).toStrictEqual([]);
});

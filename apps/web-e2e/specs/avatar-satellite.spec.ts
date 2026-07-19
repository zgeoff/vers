import { runLogin } from '../src/support/run-login';
import { expect, test } from '../src/support/test';

/**
 * `/avatar` mounts its own satellite canvas alongside the persistent world canvas: two `<canvas>`
 * elements are attached while the panel is up, and navigating away drops back to one as the
 * satellite dies with the route (`keepAlive: false`) while the tagged world canvas survives.
 */
test(
  'it mounts a second canvas for the avatar satellite and drops it on navigation away',
  { tag: '@mock' },
  async ({ page }) => {
    // two software-GL canvas mounts under CI's shared CPU run well past other specs' budget
    test.slow();

    const consoleErrors: Array<string> = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await runLogin(page, { email: 'e2e-avatar-satellite@vers.test', password: 'password123' });

    await page.goto('/avatar');

    await expect(page).toHaveURL(/\/avatar$/);

    const canvases = page.locator('canvas');

    // software-GL canvas mounts on a loaded shared runner can far outlast the suite-wide expect
    // timeout while staying sound — slow init is not a missing satellite
    await expect(canvases).toHaveCount(2, { timeout: 30_000 });

    const worldCanvas = canvases.first();

    await worldCanvas.evaluate((element) => {
      element.dataset['canvasPersistenceTag'] = 'world';
    });

    await page.getByRole('link', { exact: true, name: 'Respite' }).click();

    await expect(page).toHaveURL(/\/respite$/);
    await expect(canvases).toHaveCount(1);
    await expect(canvases.first()).toHaveAttribute('data-canvas-persistence-tag', 'world');

    expect(consoleErrors).toStrictEqual([]);
  },
);

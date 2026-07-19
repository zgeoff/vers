import { runLogin } from '../src/support/run-login';
import { expect, test } from '../src/support/test';

/**
 * The `_game` layout mounts its canvas once and never remounts it across child-route navigation:
 * a client-side nav to another game route must leave the same `<canvas>` element in the DOM,
 * carrying whatever GPU state it already uploaded.
 */
test(
  'it keeps the same canvas element across client-side game navigation',
  { tag: '@mock' },
  async ({ page }) => {
    // a real login plus five client-side game navigations, each holding a mounted Three.js canvas,
    // runs well past other specs' budget under CI's shared dev server and CPU contention
    test.slow();

    const consoleErrors: Array<string> = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await runLogin(
      page,
      { email: 'e2e-canvas@vers.test', password: 'password123' },
      { from: '/explore' },
    );

    await expect(page).toHaveURL(/\/explore$/);

    // the persistent world canvas is the first in the DOM; the avatar route mounts a second
    // satellite canvas, so an unscoped locator would break strict mode on that leg of the walk
    const canvas = page.locator('canvas').first();

    await expect(canvas).toBeVisible({ timeout: 30_000 });

    await canvas.evaluate((element) => {
      element.dataset['canvasPersistenceTag'] = 'original';
    });

    for (const [linkName, urlPattern] of [
      ['Respite', /\/respite$/],
      ['Stash', /\/stash$/],
      ['Market', /\/market$/],
      ['Avatar', /\/avatar$/],
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
  },
);

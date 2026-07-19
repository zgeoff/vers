import { buildAvatarName } from '../src/support/build-avatar-name';
import { runSignUpIntoGame } from '../src/support/run-sign-up-into-game';
import { expect, test } from '../src/support/test';
import type { JourneyAccount } from '../src/support/types';

/**
 * `/avatar` mounts its own satellite canvas alongside the persistent world canvas: two `<canvas>`
 * elements are attached while the panel is up, and navigating away drops back to one as the
 * satellite dies with the route (`keepAlive: false`) while the tagged world canvas survives.
 */
test('it mounts a second canvas for the avatar satellite and drops it on navigation away', async ({
  page,
  waitForVerificationCode,
}) => {
  // a full account-creation journey plus two software-GL canvas mounts under CI's shared CPU run
  // well past other specs' budget
  test.slow();

  const runID = Date.now();

  const account: JourneyAccount = {
    avatarName: buildAvatarName(),
    email: `e2e-avatar-satellite-${runID}@vers.test`,
    password: `e2e-password-${runID}`,
    username: `e2eavatarsat${runID}`,
  };

  await runSignUpIntoGame(page, account, waitForVerificationCode);
  await expect(page).toHaveURL(/\/explore$/);

  // scope the no-console-errors assertion to the satellite-canvas walk this spec is about; the
  // account-creation journey has its own coverage
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.getByRole('link', { exact: true, name: 'Avatar' }).click();

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
});

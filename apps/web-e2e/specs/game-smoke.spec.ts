import { buildAvatarName } from '../src/support/build-avatar-name';
import { runSignUpIntoGame } from '../src/support/run-sign-up-into-game';
import { expect, test } from '../src/support/test';
import type { JourneyAccount } from '../src/support/types';

test('it renders respite, avatar, and explore for a signed-in caller without console errors', async ({
  page,
  waitForVerificationCode,
}) => {
  // a full account-creation journey plus three client-side game navigations, each holding a
  // mounted canvas, runs past other specs' budget under CI's shared dev server and CPU contention
  test.slow();

  const runID = Date.now();

  const account: JourneyAccount = {
    avatarName: buildAvatarName(),
    email: `e2e-game-${runID}@vers.test`,
    password: `e2e-password-${runID}`,
    username: `e2egame${runID}`,
  };

  await runSignUpIntoGame(page, account, waitForVerificationCode);
  await expect(page).toHaveURL(/\/explore$/);

  // scope the no-console-errors assertion to the in-game navigation this spec is about; the
  // account-creation journey has its own coverage
  const consoleErrors: Array<string> = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.getByRole('link', { exact: true, name: 'Respite' }).click();

  await expect(page).toHaveURL(/\/respite$/);

  // the heading text also appears as the nav rail's 'Respite' link label, so a bare text locator
  // would break strict mode
  await expect(page.getByRole('heading', { name: 'Respite' })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  // guard against the app shipping without its generated stylesheet: at least one sheet must be
  // linked, preflight must have applied (body margin reset), and the preset's global token
  // variables must resolve
  const styleProbe = await page.evaluate(() => ({
    bodyMargin: getComputedStyle(document.body).margin,
    fontBodyVar: getComputedStyle(document.documentElement)
      .getPropertyValue('--global-font-body')
      .trim(),
    sheetCount: document.styleSheets.length,
  }));

  expect(styleProbe.sheetCount).toBeGreaterThan(0);
  expect(styleProbe.bodyMargin).toBe('0px');
  expect(styleProbe.fontBodyVar).not.toBe('');

  await page.getByRole('link', { exact: true, name: 'Avatar' }).click();

  await expect(page).toHaveURL(/\/avatar$/);

  await page.getByRole('link', { exact: true, name: 'Explore' }).click();

  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  expect(consoleErrors).toStrictEqual([]);
});

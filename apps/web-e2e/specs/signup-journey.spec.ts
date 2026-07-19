import { buildAvatarName } from '../src/support/build-avatar-name';
import { runLogin } from '../src/support/run-login';
import { runSettingsLogout } from '../src/support/run-settings-logout';
import { runSignUpIntoGame } from '../src/support/run-sign-up-into-game';
import { expect, test } from '../src/support/test';
import type { JourneyAccount } from '../src/support/types';

test(
  'it signs up, creates an avatar, and can navigate the shell to settings and log out',
  { tag: '@journey' },
  async ({ page, waitForVerificationCode }) => {
    const runID = Date.now();

    const account: JourneyAccount = {
      avatarName: buildAvatarName(),
      email: `e2e-signup-${runID}@vers.test`,
      password: `e2e-password-${runID}`,
      username: `e2esignup${runID}`,
    };

    await runSignUpIntoGame(page, account, waitForVerificationCode);
    await expect(page.locator('canvas').first()).toBeVisible();
    await runSettingsLogout(page);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  },
);

test(
  'it logs a fresh account out and back in, landing signed in at respite',
  { tag: '@journey' },
  async ({ page, waitForVerificationCode }) => {
    const runID = Date.now();

    const account: JourneyAccount = {
      avatarName: buildAvatarName(),
      email: `e2e-login-${runID}@vers.test`,
      password: `e2e-password-${runID}`,
      username: `e2elogin${runID}`,
    };

    await runSignUpIntoGame(page, account, waitForVerificationCode);
    await runSettingsLogout(page);
    await runLogin(page, account);
    await expect(page).toHaveURL(/\/respite$/);
  },
);

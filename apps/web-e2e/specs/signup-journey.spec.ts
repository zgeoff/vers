import {
  buildAvatarName,
  runLogin,
  runSettingsLogout,
  runSignUpIntoGame,
} from '../src/support/journey';
import { expect, test } from '../src/support/test';
import type { JourneyAccount } from '../src/support/types';

test(
  'it signs up, creates an avatar, and can navigate the shell to settings and log out',
  { tag: '@journey' },
  async ({ getVerificationCode, page }) => {
    const runID = Date.now();

    const account: JourneyAccount = {
      avatarName: buildAvatarName(),
      email: `e2e-signup-${runID}@vers.test`,
      password: `e2e-password-${runID}`,
      username: `e2esignup${runID}`,
    };

    await runSignUpIntoGame(page, account, getVerificationCode);
    await expect(page.locator('canvas').first()).toBeVisible();
    await runSettingsLogout(page);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  },
);

test(
  'it logs a fresh account out and back in, landing signed in at respite',
  { tag: '@journey' },
  async ({ getVerificationCode, page }) => {
    const runID = Date.now();

    const account: JourneyAccount = {
      avatarName: buildAvatarName(),
      email: `e2e-login-${runID}@vers.test`,
      password: `e2e-password-${runID}`,
      username: `e2elogin${runID}`,
    };

    await runSignUpIntoGame(page, account, getVerificationCode);
    await runSettingsLogout(page);
    await runLogin(page, account);
  },
);

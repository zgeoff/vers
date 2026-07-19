import type { Page } from '@playwright/test';
import { expect } from './test';

/**
 * Opens the in-shell settings screen and logs out back to the anonymous home page.
 */
export async function runSettingsLogout(page: Page): Promise<void> {
  // the game canvas's initial scene setup blocks the main thread for a variable stretch, long
  // enough that a click fired mid-block is silently dropped — retry until the nav visibly opens
  await expect(async () => {
    await page.getByRole('link', { exact: true, name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');
}

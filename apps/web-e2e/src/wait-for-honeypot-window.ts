import type { Page } from '@playwright/test';

/**
 * Waits until the page's honeypot valid-from timestamp has passed, so a form submit isn't flagged
 * as bot-speed. The suite runs the production artifact with its real human-speed floor — no
 * build-time override — so every spec that submits an auth form must pace itself past the window
 * the freshly rendered form declares.
 */
export async function waitForHoneypotWindow(page: Page): Promise<void> {
  const validFrom = await page.locator('input[name="from__confirm"]').inputValue();

  const remainingMs = Number(validFrom) - Date.now();

  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs + 100);
  }
}

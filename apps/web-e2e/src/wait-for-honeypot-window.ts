import type { Page } from '@playwright/test';

export async function waitForHoneypotWindow(page: Page): Promise<void> {
  const validFrom = await page.locator('input[name="from__confirm"]').inputValue();

  const remainingMs = Number(validFrom) - Date.now();

  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs + 100);
  }
}

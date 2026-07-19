import type { Page } from '@playwright/test';
import { waitForHoneypotWindow } from '../wait-for-honeypot-window';
import type { JourneyAccount } from './types';

/**
 * Fills and submits the login form and waits to leave `/login`, leaving the caller to assert its
 * own landing — the target varies by account (a fresh account lands at `/respite`, a seeded one
 * lands wherever its state directs).
 */
export async function runLogin(
  page: Page,
  account: Pick<JourneyAccount, 'email' | 'password'>,
): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

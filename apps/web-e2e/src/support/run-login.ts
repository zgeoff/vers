import type { Page } from '@playwright/test';
import { waitForHoneypotWindow } from '../wait-for-honeypot-window';
import type { JourneyAccount } from './types';

interface RunLoginOptions {
  /**
   * A protected route to enter from: navigating there while signed out redirects to `/login`
   * carrying the return-to, so the post-login landing is that route. Omit to go straight to
   * `/login`, where the landing is the account's default (`/respite`).
   */
  readonly from?: string;
}

/**
 * Fills and submits the login form and waits to leave `/login`, leaving the caller to assert its
 * own landing.
 */
export async function runLogin(
  page: Page,
  account: Pick<JourneyAccount, 'email' | 'password'>,
  options: Readonly<RunLoginOptions> = {},
): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto(options.from ?? '/login');

  // hydration gate: the login form's submit handler attaches only once React commits; an earlier
  // click falls back to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

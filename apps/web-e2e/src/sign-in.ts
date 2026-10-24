import type { Page } from '@playwright/test';
import { waitForHoneypotWindow } from './wait-for-honeypot-window';

export async function signIn(page: Page, email: string): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/login');

  // the login form's submit handler attaches only once React commits; an earlier click falls back
  // to the browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
}

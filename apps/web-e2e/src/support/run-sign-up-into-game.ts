import type { Page } from '@playwright/test';
import { waitForHoneypotWindow } from '../wait-for-honeypot-window';
import { expect } from './test';
import type { JourneyAccount } from './types';

/**
 * Drives the whole account-creation journey — signup, emailed-code verification, onboarding, and
 * avatar creation — and lands signed in at `/explore`.
 */
export async function runSignUpIntoGame(
  page: Page,
  account: JourneyAccount,
  waitForVerificationCode: (email: string) => Promise<string>,
): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });

  await runSignUp(page, account.email);

  const code = await waitForVerificationCode(account.email);

  await runVerifyOTP(page, code);
  await runOnboarding(page, account);
  await runAvatarCreate(page, account.avatarName);
}

/**
 * Fills and submits the signup form and waits for the emailed-code verification step.
 */
async function runSignUp(page: Page, email: string): Promise<void> {
  await page.goto('/signup');

  // hydration gate: the form's submit handler attaches only once React commits; an earlier click
  // falls back to the browser's native GET submit
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(email);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Signup' }).click();

  await expect(page).toHaveURL(/\/verify-otp/);
}

/**
 * Enters and submits the emailed code and waits for the onboarding step.
 */
async function runVerifyOTP(page: Page, code: string): Promise<void> {
  await page.getByTestId('otp-input').pressSequentially(code);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/\/onboarding/);
}

/**
 * Fills and submits the onboarding form. A fresh account carries no avatar yet, so the caller
 * lands on the create-avatar sheet next — `runAvatarCreate` is the one that waits for it.
 */
async function runOnboarding(
  page: Page,
  account: Pick<JourneyAccount, 'password' | 'username'>,
): Promise<void> {
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Name', { exact: true }).fill('Journey Account');
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm Password').fill(account.password);
  await page.getByText('Agree to terms').click();

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { name: 'Create an Account' }).click();
}

/**
 * Waits for the active-avatar gate's redirect to the create sheet, then fills and submits the
 * avatar name and waits for the landing in-game at `/explore`.
 */
async function runAvatarCreate(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL(/\/avatars\/create$/, { timeout: 20_000 });

  const nameField = page.getByLabel('Name', { exact: true });

  // the form is plain client state (no Conform action) that mounts after hydration; a fill
  // landing on the still-server-rendered markup gets discarded when hydration takes over — retry
  // until the typed value survives
  await expect(async () => {
    await nameField.fill(name);

    await expect(nameField).toHaveValue(name, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Create Avatar' }).click();

  await expect(page).toHaveURL(/\/explore$/, { timeout: 20_000 });
}

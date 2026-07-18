import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

const resendStubURL = process.env['RESEND_STUB_URL'] ?? 'http://localhost:3020';
const CapturedEmailSchema = z.object({ text: z.string() });

const CapturedEmailsSchema = z.object({
  emails: z.array(CapturedEmailSchema),
});

/**
 * The onboarding verification code, pulled from the welcome email the real service-email handed
 * the Resend stub. Delivery is a fire-and-forget queue drain behind the signup response, so the
 * capture is polled; the code rides the email's verification URL as its `code` query param.
 */
async function waitForVerificationCode(email: string): Promise<string> {
  let code: null | string = null;

  await expect(async () => {
    const response = await fetch(`${resendStubURL}/emails?to=${encodeURIComponent(email)}`);
    const raw: unknown = await response.json();

    const body = CapturedEmailsSchema.parse(raw);
    const match = body.emails.at(-1)?.text.match(/code=(?<code>[A-Z0-9]{6})/);

    expect(match).toBeTruthy();

    code = match?.groups?.['code'] ?? null;
  }).toPass({ timeout: 20_000 });

  expect(code).not.toBeNull();

  return code ?? '';
}

interface SignupAccount {
  readonly email: string;
  readonly password: string;
  readonly username: string;
}

/**
 * Drives the whole account-creation journey — signup, emailed-code verification, onboarding —
 * and lands at `/respite` signed in. Every form submit paces past the artifact's real honeypot
 * window first.
 */
async function runSignupJourney(page: Page, account: SignupAccount): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/signup');

  // hydration gate: the form's submit handler attaches only once React commits; an earlier click
  // falls back to the browser's native GET submit
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(account.email);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Signup' }).click();

  await expect(page).toHaveURL(/\/verify-otp/);

  const code = await waitForVerificationCode(account.email);

  // the TOTP window is ~30-90s from generation, so the code goes in promptly after capture
  await page.getByTestId('otp-input').pressSequentially(code);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Name', { exact: true }).fill('Stack Journey');
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm Password').fill(account.password);
  await page.getByText('Agree to terms').click();

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { name: 'Create an Account' }).click();

  await expect(page).toHaveURL(/\/respite$/, { timeout: 20_000 });
}

test('it signs up, verifies the emailed code, onboards, and lands in the game signed in', async ({
  page,
}) => {
  const runID = Date.now();

  await runSignupJourney(page, {
    email: `e2e-signup-${runID}@vers.test`,
    password: `e2e-password-${runID}`,
    username: `e2e${runID}`,
  });

  await expect(page.locator('canvas')).toBeVisible();
});

test('it logs a fresh account out and back in through the real session service', async ({
  page,
}) => {
  const runID = Date.now();
  const email = `e2e-login-${runID}@vers.test`;
  const password = `e2e-password-${runID}`;

  await runSignupJourney(page, { email, password, username: `e2el${runID}` });

  // the game canvas's initial scene setup blocks the main thread for a variable stretch, long
  // enough that a click fired mid-block is silently dropped — retry until the nav visibly opens
  const accountLink = page.getByRole('link', { exact: true, name: 'Account' });

  await expect(async () => {
    await page.getByRole('button', { name: 'Menu' }).click();

    await expect(accountLink).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await accountLink.click();

  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');

  await page.goto('/login');
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/, { timeout: 20_000 });
});

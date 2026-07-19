import { randomBytes } from 'node:crypto';
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
  readonly avatarName: string;
  readonly email: string;
  readonly password: string;
  readonly username: string;
}

/**
 * Drives the whole account-creation journey — signup, emailed-code verification, onboarding, then
 * the roster's create-avatar step — and lands in the game at `/explore` signed in. Every form
 * submit paces past the artifact's real honeypot window first.
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

  // a fresh account onboards onto the empty roster and must create an avatar before the shell's
  // active-avatar gate admits it to the game
  await expect(page).toHaveURL(/\/avatars$/, { timeout: 20_000 });

  await page.getByRole('link', { name: '+ Create avatar' }).click();

  await expect(page).toHaveURL(/\/avatars\/create$/);

  await page.getByLabel('Name', { exact: true }).fill(account.avatarName);
  await page.getByRole('button', { name: 'Create Avatar' }).click();

  await expect(page).toHaveURL(/\/explore$/, { timeout: 20_000 });
}

test('it signs up, verifies the emailed code, onboards, creates an avatar, and lands in the game', async ({
  page,
}) => {
  const runID = Date.now();

  await runSignupJourney(page, {
    avatarName: buildAvatarName(),
    email: `e2e-signup-${runID}@vers.test`,
    password: `e2e-password-${runID}`,
    username: `e2e${runID}`,
  });

  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
});

test('it logs a fresh account out and back in through the real session service', async ({
  page,
}) => {
  const runID = Date.now();
  const email = `e2e-login-${runID}@vers.test`;
  const password = `e2e-password-${runID}`;
  const avatarName = buildAvatarName();

  await runSignupJourney(page, { avatarName, email, password, username: `e2el${runID}` });

  // the game canvas's initial scene setup blocks the main thread for a variable stretch, long
  // enough that a click fired mid-block is silently dropped — retry until the nav lands
  await expect(async () => {
    await page.getByRole('link', { exact: true, name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');

  await page.goto('/login');
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  // login lands on the roster; the account's one avatar leads back into the game
  await expect(page).toHaveURL(/\/avatars$/, { timeout: 20_000 });

  await page.getByRole('link', { name: avatarName }).click();

  await expect(page).toHaveURL(/\/explore$/, { timeout: 20_000 });
});

/**
 * A per-run avatar name meeting the letters-only name schema: random bytes mapped onto `a`–`z`, so
 * two workers or CI jobs starting in the same millisecond can't collide on the global name
 * constraint the way a clock-derived name could.
 */
function buildAvatarName(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  return Array.from(randomBytes(12), (byte) => alphabet.charAt(byte % alphabet.length)).join('');
}

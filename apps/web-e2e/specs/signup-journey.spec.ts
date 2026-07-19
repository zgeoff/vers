import type { Page } from '@playwright/test';
import { z } from 'zod';
import { expect, test } from '../src/test';
import type { E2EOptions } from '../src/test';
import { waitForHoneypotWindow } from '../src/wait-for-honeypot-window';

test('it signs up, creates an avatar, and can navigate the shell to settings and log out', async ({
  codeSource,
  mockVerificationURL,
  page,
  resendStubURL,
}) => {
  const runID = Date.now();

  await runSignUpIntoGame(page, {
    avatarName: buildAvatarName(),
    codeSource,
    email: `e2e-signup-${runID}@vers.test`,
    mockVerificationURL,
    password: `e2e-password-${runID}`,
    resendStubURL,
    username: `e2esignup${runID}`,
  });

  await expect(page.locator('canvas').first()).toBeVisible();

  // the game canvas's initial scene setup blocks the main thread for a variable stretch, long
  // enough that a click fired mid-block is silently dropped — retry until the nav visibly opens
  await expect(async () => {
    await page.getByRole('link', { exact: true, name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('it logs a fresh account out and back in, landing signed in at respite', async ({
  codeSource,
  mockVerificationURL,
  page,
  resendStubURL,
}) => {
  const runID = Date.now();
  const email = `e2e-login-${runID}@vers.test`;
  const password = `e2e-password-${runID}`;

  await runSignUpIntoGame(page, {
    avatarName: buildAvatarName(),
    codeSource,
    email,
    mockVerificationURL,
    password,
    resendStubURL,
    username: `e2elogin${runID}`,
  });

  await expect(async () => {
    await page.getByRole('link', { exact: true, name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL('/');

  await page.goto('/login');
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();

  await expect(page).toHaveURL(/\/respite$/);
});

interface SignUpJourney extends E2EOptions {
  readonly avatarName: string;
  readonly email: string;
  readonly password: string;
  readonly username: string;
}

/**
 * Drives the whole account-creation journey — signup, emailed-code verification, onboarding, and
 * avatar creation — and lands signed in at `/explore`. Every form submit paces past the artifact's
 * real honeypot window first.
 */
async function runSignUpIntoGame(page: Page, journey: Readonly<SignUpJourney>): Promise<void> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '127.0.0.1' });
  await page.goto('/signup');

  // hydration gate: the form's submit handler attaches only once React commits; an earlier click
  // falls back to the browser's native GET submit
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(journey.email);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Signup' }).click();

  await expect(page).toHaveURL(/\/verify-otp/);

  const code = await waitForVerificationCode(journey);

  await page.getByTestId('otp-input').pressSequentially(code);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Verify' }).click();

  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel('Username').fill(journey.username);
  await page.getByLabel('Name', { exact: true }).fill('Journey Account');
  await page.getByLabel('Password', { exact: true }).fill(journey.password);
  await page.getByLabel('Confirm Password').fill(journey.password);
  await page.getByText('Agree to terms').click();

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { name: 'Create an Account' }).click();

  await expect(page).toHaveURL(/\/avatars\/create$/, { timeout: 20_000 });

  const nameField = page.getByLabel('Name', { exact: true });

  // the create-avatar form is plain client state (no Conform action) that mounts after hydration;
  // a fill landing on the still-server-rendered markup gets discarded when hydration takes over —
  // retry until the typed value survives
  await expect(async () => {
    await nameField.fill(journey.avatarName);

    await expect(nameField).toHaveValue(journey.avatarName, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Create Avatar' }).click();

  await expect(page).toHaveURL(/\/explore$/, { timeout: 20_000 });
}

/**
 * Reads the onboarding code from whichever backend the journey signed up against: the mock
 * verification service's e2e lookup, or the resend stub that captured the real service-email's
 * welcome message.
 */
function waitForVerificationCode(
  options: Readonly<E2EOptions & { email: string }>,
): Promise<string> {
  return options.codeSource === 'mock'
    ? waitForMockVerificationCode(options.email, options.mockVerificationURL)
    : waitForStackVerificationCode(options.email, options.resendStubURL);
}

const MockVerificationCodeSchema = z.object({ code: z.string() });

/**
 * Polls the mock backend's test-only verification-code endpoint, which answers 404 until
 * `createVerification` has stored a row for the email — the welcome-email send that carries the
 * same code is a fire-and-forget queue drain behind the signup response.
 */
async function waitForMockVerificationCode(
  email: string,
  mockVerificationURL: string | undefined,
): Promise<string> {
  if (mockVerificationURL === undefined) {
    throw new Error('codeSource "mock" requires mockVerificationURL');
  }

  const searchParams = new URLSearchParams({ target: email, type: 'onboarding' });

  let code: string | undefined;

  await expect(async () => {
    const response = await fetch(`${mockVerificationURL}/test/verification-code?${searchParams}`);

    expect(response.status).toBe(200);

    const body: unknown = await response.json();

    code = MockVerificationCodeSchema.parse(body).code;
  }).toPass({ timeout: 20_000 });

  if (code === undefined) {
    throw new Error('verification code poll resolved with no code');
  }

  return code;
}

const CapturedEmailSchema = z.object({ text: z.string() });
const CapturedEmailsSchema = z.object({ emails: z.array(CapturedEmailSchema) });

/**
 * Polls the resend stub's capture endpoint for the welcome email the real service-email handed it
 * and pulls the onboarding code out of the verification URL its `code` query param carries.
 */
async function waitForStackVerificationCode(
  email: string,
  resendStubURL: string | undefined,
): Promise<string> {
  if (resendStubURL === undefined) {
    throw new Error('codeSource "stack" requires resendStubURL');
  }

  let code: string | undefined;

  await expect(async () => {
    const response = await fetch(`${resendStubURL}/emails?to=${encodeURIComponent(email)}`);
    const raw: unknown = await response.json();

    const body = CapturedEmailsSchema.parse(raw);
    const lastEmail = body.emails.at(-1);
    const match = lastEmail?.text.match(/code=(?<code>[A-Z0-9]{6})/);

    expect(match).toBeTruthy();

    code = match?.groups?.['code'];
  }).toPass({ timeout: 20_000 });

  if (code === undefined) {
    throw new Error('verification code poll resolved with no code');
  }

  return code;
}

/**
 * A globally-unique letters-only avatar name: `AvatarNameSchema` accepts letters only, and the
 * real stack's database persists across runs and enforces the same uniqueness the mock backend
 * does.
 */
function buildAvatarName(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  return Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (byte) => alphabet[byte % alphabet.length],
  ).join('');
}

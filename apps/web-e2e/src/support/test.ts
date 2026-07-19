import { test as base, expect } from '@playwright/test';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import type { JourneyOptions } from './types';

interface JourneyFixtures {
  readonly waitForVerificationCode: (email: string) => Promise<string>;
}

/**
 * The converged spec set's shared `test`: `codeSource` and its origin options are project-level
 * (set in each config's `use`), so a spec's call to `waitForVerificationCode` runs unmodified
 * against the mock backend's HTTP lookup and the stack's captured-email poll.
 */
export const test = base.extend<JourneyOptions & JourneyFixtures>({
  codeSource: ['mock', { option: true }],

  waitForVerificationCode: async ({ codeSource, mockVerificationURL, resendStubURL }, provide) => {
    await provide((email) =>
      codeSource === 'mock'
        ? waitForMockVerificationCode(email, mockVerificationURL)
        : waitForStackVerificationCode(email, resendStubURL),
    );
  },

  mockVerificationURL: [undefined, { option: true }],
  resendStubURL: [undefined, { option: true }],
});

export { expect } from '@playwright/test';
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
  invariant(mockVerificationURL !== undefined, 'codeSource "mock" requires mockVerificationURL');

  const searchParams = new URLSearchParams({ target: email, type: 'onboarding' });

  let code: string | undefined;

  await expect(async () => {
    const response = await fetch(`${mockVerificationURL}/test/verification-code?${searchParams}`);

    expect(response.status).toBe(200);

    const body: unknown = await response.json();

    code = MockVerificationCodeSchema.parse(body).code;
  }).toPass({ timeout: 20_000 });

  invariant(code !== undefined, 'verification code poll resolved with no code');

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
  invariant(resendStubURL !== undefined, 'codeSource "stack" requires resendStubURL');

  let code: string | undefined;

  await expect(async () => {
    const response = await fetch(`${resendStubURL}/emails?to=${encodeURIComponent(email)}`);
    const raw: unknown = await response.json();

    const body = CapturedEmailsSchema.parse(raw);
    const match = body.emails.at(-1)?.text.match(/code=(?<code>[A-Z0-9]{6})/);

    expect(match).toBeTruthy();

    code = match?.groups?.['code'];
  }).toPass({ timeout: 20_000 });

  invariant(code !== undefined, 'verification code poll resolved with no code');

  return code;
}

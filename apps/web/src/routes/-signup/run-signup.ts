import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { redirect } from '@tanstack/react-router';
import { getRequest } from '@tanstack/react-start/server';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { SignupFormSchema } from './signup-form-schema';

/**
 * Runs the signup form's submission: honeypot then field validation, then either an onboarding
 * verification code emailed to a caller with no account yet, or an existing-account notice for
 * one that already has an account. Always redirects to verify-otp, so the response never
 * distinguishes which email was sent.
 */
export async function runSignup(formData: FormData): Promise<Response | SubmissionResult> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: SignupFormSchema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  const email = submission.value.email;

  const existing = await userClient.getUser({ email });

  if (existing === null) {
    const verification = await verificationClient.createVerification({
      target: email,
      type: 'onboarding',
    });

    const origin = new URL(getRequest().url).origin;

    const verificationURL = `${origin}/verify-otp?${new URLSearchParams({ code: verification.otp, target: email, type: 'onboarding' }).toString()}`;

    await emailClient.sendWelcome({
      to: email,
      verificationCode: verification.otp,
      verificationURL,
    });
  } else {
    await emailClient.sendExistingAccount({ email, to: email });
  }

  const searchParams = new URLSearchParams({ target: email, type: 'onboarding' });

  throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
}

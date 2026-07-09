import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { SignupFormSchema } from './signup-form-schema';

/**
 * Runs the signup form's submission: honeypot then field validation, then — for a caller with no
 * account yet — an onboarding verification code sent to that address. Always redirects to
 * verify-otp, including for an existing account (which gets no verification created for it), so
 * the response never distinguishes an existing account from a new one.
 */
export async function signupHandler(formData: FormData): Promise<Response | SubmissionResult> {
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

  const existing = await userClient.getUser({ email: submission.value.email });

  if (existing === null) {
    await verificationClient.createVerification({
      target: submission.value.email,
      type: 'onboarding',
    });
  }

  const searchParams = new URLSearchParams({ target: submission.value.email, type: 'onboarding' });

  throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
}

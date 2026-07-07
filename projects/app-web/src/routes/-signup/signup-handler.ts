import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { SignupFormSchema } from './signup-form-schema';
import type { SignupResult } from './signup-result';

/**
 * Runs the signup form's submission: honeypot then field validation, an existing-account check,
 * and — for a caller with no account yet — an onboarding verification code sent to that address.
 * Ends in a redirect to verify-otp either way; there's no successful non-redirect outcome.
 */
export async function signupHandler(formData: FormData): Promise<Response | SignupResult> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = SignupFormSchema.safeParse({ email: formData.get('email') });

  if (!submission.success) {
    const [issue] = submission.error.issues;

    return {
      fieldErrors: { email: issue?.message ?? 'Email is invalid' },
      status: 'invalid-fields',
    };
  }

  const existing = await userClient.getUser({ email: submission.data.email });

  if (existing !== null) {
    return {
      fieldErrors: { email: 'An account with this email already exists' },
      status: 'invalid-fields',
    };
  }

  await verificationClient.createVerification({
    target: submission.data.email,
    type: 'onboarding',
  });

  const searchParams = new URLSearchParams({ target: submission.data.email, type: 'onboarding' });

  throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
}

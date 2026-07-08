import { redirect } from '@tanstack/react-router';
import { checkStepUp } from '../../lib/auth/check-step-up';
import { findStepUpToken } from '../../lib/auth/find-step-up-token';
import { requireAuth } from '../../lib/auth/require-auth';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { ChangeEmailFormSchema } from './change-email-form-schema';
import type { ChangeEmailResult } from './types';

/**
 * Runs the change-email form's submission: field validation, then a step-up gate for a
 * 2FA-enabled caller. Once cleared (immediately, or via a step-up-token resubmission), a
 * `change-email`-typed verification code is created for the new address and the caller is sent to
 * the shared verify-otp hub to confirm ownership before the address is actually applied.
 */
export async function changeEmailHandler(formData: FormData): Promise<ChangeEmailResult> {
  await requireAuth();

  const submission = ChangeEmailFormSchema.safeParse({ email: formData.get('email') });

  if (!submission.success) {
    const [issue] = submission.error.issues;

    return {
      fieldErrors: { email: issue?.message ?? 'Email is invalid' },
      status: 'invalid-fields',
    };
  }

  const user = await userClient.getCurrentUser({});

  const stepUp = await checkStepUp({
    action: 'ChangeEmail',
    target: user.id,
    token: findStepUpToken(formData),
  });

  if (stepUp.status === 'required') {
    return { status: 'step-up-required', target: user.id, transactionID: stepUp.transactionID };
  }

  await verificationClient.createVerification({
    target: submission.data.email,
    type: 'change-email',
  });

  const searchParams = new URLSearchParams({
    target: submission.data.email,
    type: 'change-email',
  });

  throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
}

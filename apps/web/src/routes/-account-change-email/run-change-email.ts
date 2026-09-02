import { redirect } from '@tanstack/react-router';
import { getRequest } from '@tanstack/react-start/server';
import { checkStepUp } from '../../lib/auth/check-step-up';
import { findStepUpToken } from '../../lib/auth/find-step-up-token';
import { requireAuth } from '../../lib/auth/require-auth';
import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { ChangeEmailFormSchema } from './change-email-form-schema';
import type { ChangeEmailResult } from './types';

export async function runChangeEmail(formData: FormData): Promise<ChangeEmailResult> {
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

  const verification = await verificationClient.createVerification({
    target: submission.data.email,
    type: 'change-email',
  });

  const origin = new URL(getRequest().url).origin;

  const verificationURL = `${origin}/verify-otp?${new URLSearchParams({ code: verification.otp, target: submission.data.email, type: 'change-email' }).toString()}`;

  await emailClient.sendChangeEmailVerification({
    newEmail: submission.data.email,
    to: submission.data.email,
    verificationCode: verification.otp,
    verificationURL,
  });

  const searchParams = new URLSearchParams({
    target: submission.data.email,
    type: 'change-email',
  });

  throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
}

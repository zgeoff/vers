import { redirect } from '@tanstack/react-router';
import { checkStepUp } from '../../lib/auth/check-step-up';
import { findStepUpToken } from '../../lib/auth/find-step-up-token';
import { requireAuth } from '../../lib/auth/require-auth';
import { userClient } from '../../lib/rpc/clients/user-client';
import { ChangePasswordFormSchema } from './change-password-form-schema';
import type { ChangePasswordResult } from './change-password-result';

/**
 * Runs the change-password form's submission: field validation, a step-up gate for a 2FA-enabled
 * caller, then a current-password check before the new password is applied.
 */
export async function changePasswordHandler(formData: FormData): Promise<ChangePasswordResult> {
  await requireAuth();

  const submission = ChangePasswordFormSchema.safeParse({
    confirmPassword: formData.get('confirmPassword'),
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
  });

  if (!submission.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of submission.error.issues) {
      const [field] = issue.path;

      if (typeof field === 'string' && !(field in fieldErrors)) {
        fieldErrors[field] = issue.message;
      }
    }

    return { fieldErrors, status: 'invalid-fields' };
  }

  const user = await userClient.getCurrentUser({});

  const stepUp = await checkStepUp({
    action: 'ChangePassword',
    target: user.id,
    token: findStepUpToken(formData),
  });

  if (stepUp.status === 'required') {
    return { status: 'step-up-required', target: user.id, transactionID: stepUp.transactionID };
  }

  const verified = await userClient.verifyPassword({
    email: user.email,
    password: submission.data.currentPassword,
  });

  if (!verified.success) {
    return { formError: 'Current password is incorrect', status: 'invalid-credentials' };
  }

  await userClient.changePassword({ password: submission.data.password });

  throw redirect({ href: '/account' });
}

import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { isDefinedError, safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { logger } from '../../server/logger';
import { ResetPasswordFormSchema } from './reset-password-form-schema';

const INVALID_LINK_ERROR = 'This reset link is invalid or has expired.';

/**
 * Runs the reset-password form's submission: honeypot then field validation, then applies the new
 * password against the emailed link's token and emails a password-changed notice. Signs the
 * caller out everywhere on success.
 */
export async function resetPasswordHandler(
  formData: FormData,
): Promise<Response | SubmissionResult> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: ResetPasswordFormSchema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  const user = await userClient.getUser({ email: submission.value.email });

  if (user === null) {
    return submission.reply({ formErrors: [INVALID_LINK_ERROR] });
  }

  const [error] = await safe(
    userClient.resetPassword({
      id: user.id,
      password: submission.value.password,
      resetToken: submission.value.resetToken,
    }),
  );

  if (error) {
    if (!isDefinedError(error)) {
      logger.error({ err: error }, 'password reset failed');
    }

    return submission.reply({ formErrors: [INVALID_LINK_ERROR] });
  }

  await emailClient.sendPasswordChanged({
    email: submission.value.email,
    to: submission.value.email,
  });

  throw redirect({ href: '/login' });
}

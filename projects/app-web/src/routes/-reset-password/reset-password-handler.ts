import { safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import type { z } from 'zod';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { userClient } from '../../lib/rpc/clients/user-client';
import { ResetPasswordFormSchema } from './reset-password-form-schema';
import type { ResetPasswordResult } from './types';

const INVALID_LINK_RESULT: ResetPasswordResult = {
  fieldErrors: {},
  formError: 'This reset link is invalid or has expired.',
  status: 'invalid-fields',
};

/**
 * Runs the reset-password form's submission: honeypot then field validation, then applies the new
 * password against the emailed link's token. Signs the caller out everywhere on success.
 */
export async function resetPasswordHandler(
  formData: FormData,
): Promise<ResetPasswordResult | Response> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = ResetPasswordFormSchema.safeParse({
    confirmPassword: formData.get('confirmPassword'),
    email: formData.get('email'),
    password: formData.get('password'),
    resetToken: formData.get('resetToken'),
  });

  if (!submission.success) {
    return { fieldErrors: toFieldErrors(submission.error), status: 'invalid-fields' };
  }

  const user = await userClient.getUser({ email: submission.data.email });

  if (user === null) {
    return INVALID_LINK_RESULT;
  }

  const [error] = await safe(
    userClient.resetPassword({
      id: user.id,
      password: submission.data.password,
      resetToken: submission.data.resetToken,
    }),
  );

  if (error) {
    return INVALID_LINK_RESULT;
  }

  throw redirect({ href: '/login' });
}

function toFieldErrors(error: z.ZodError): Partial<Record<'confirmPassword' | 'password', string>> {
  const fieldErrors: Partial<Record<'confirmPassword' | 'password', string>> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if ((field === 'confirmPassword' || field === 'password') && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

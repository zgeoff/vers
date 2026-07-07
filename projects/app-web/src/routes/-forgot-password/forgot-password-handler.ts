import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { userClient } from '../../lib/rpc/clients/user-client';
import { ForgotPasswordFormSchema } from './forgot-password-form-schema';
import type { ForgotPasswordResult } from './forgot-password-result';

/**
 * Runs the forgot-password form's submission: honeypot then field validation, then — for a
 * matching account — mints a reset token to email out. Always ends in the same redirect whether
 * or not the address matches an account, so this page can't be used to enumerate accounts.
 */
export async function forgotPasswordHandler(
  formData: FormData,
): Promise<ForgotPasswordResult | Response> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = ForgotPasswordFormSchema.safeParse({ email: formData.get('email') });

  if (!submission.success) {
    const [issue] = submission.error.issues;

    return {
      fieldErrors: { email: issue?.message ?? 'Email is invalid' },
      status: 'invalid-fields',
    };
  }

  const user = await userClient.getUser({ email: submission.data.email });

  if (user !== null) {
    await userClient.createPasswordResetToken({ id: user.id });
  }

  throw redirect({ href: '/reset-password-started' });
}

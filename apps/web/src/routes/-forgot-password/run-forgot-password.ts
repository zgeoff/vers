import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { redirect } from '@tanstack/react-router';
import { getRequest } from '@tanstack/react-start/server';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { ForgotPasswordFormSchema } from './forgot-password-form-schema';

export async function runForgotPassword(formData: FormData): Promise<Response | SubmissionResult> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: ForgotPasswordFormSchema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  const user = await userClient.getUser({ email: submission.value.email });

  if (user !== null) {
    const passwordReset = await userClient.createPasswordResetToken({ id: user.id });

    const origin = new URL(getRequest().url).origin;

    const resetURL = `${origin}/reset-password?${new URLSearchParams({ email: submission.value.email, token: passwordReset.resetToken }).toString()}`;

    await emailClient.sendResetPassword({ resetURL, to: submission.value.email });
  }

  throw redirect({ href: '/reset-password-started' });
}

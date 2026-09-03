import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { redirect } from '@tanstack/react-router';
import { getRequestIP } from '@tanstack/react-start/server';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { runSessionSignIn } from '../../lib/auth/run-session-sign-in';
import { SpamError } from '../../lib/auth/spam-error';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { LoginFormSchema } from './login-form-schema';

export async function runLogin(formData: FormData): Promise<Response | SubmissionResult> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: LoginFormSchema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  const user = await userClient.getUser({ email: submission.value.email });

  if (user === null) {
    return submission.reply({ formErrors: ['Invalid email or password'] });
  }

  const verified = await userClient.verifyPassword({
    email: submission.value.email,
    password: submission.value.password,
  });

  if (!verified.success) {
    return submission.reply({ formErrors: ['Invalid email or password'] });
  }

  const session = await sessionClient.createSession({
    ipAddress: getRequestIP() ?? '0.0.0.0',
    rememberMe: submission.value.rememberMe,
    userID: user.id,
  });

  const twoFactorVerification = await verificationClient.getVerification({
    target: user.id,
    type: '2fa',
  });

  if (twoFactorVerification !== null) {
    await updateVerifySession({
      'login2FA#sessionID': session.id,
      'login2FA#target': user.id,
    });

    const searchParams = new URLSearchParams({ target: user.id, type: '2fa' });

    if (submission.value.redirectTo !== undefined) {
      searchParams.set('redirect', submission.value.redirectTo);
    }

    throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
  }

  return runSessionSignIn({
    email: submission.value.email,
    redirectTo: submission.value.redirectTo,
    session,
  });
}

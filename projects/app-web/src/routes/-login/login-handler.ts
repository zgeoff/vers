import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { redirect } from '@tanstack/react-router';
import { getRequestIP } from '@tanstack/react-start/server';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { completeSessionSignIn } from '../../lib/auth/complete-session-sign-in';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { LoginFormSchema } from './login-form-schema';

/**
 * Runs the login form's submission: honeypot then field validation, a credential check, and — for
 * a caller with neither 2FA nor a competing live session — a completed sign-in. A 2FA-enabled
 * account or an already-live session ends in a redirect instead of a result, carrying just enough
 * verify-session state (the pending session's id) for the next step to complete it. A wrong
 * email or password reports a single form-level error, never which of the two was wrong.
 */
export async function loginHandler(formData: FormData): Promise<Response | SubmissionResult> {
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

  return completeSessionSignIn({
    email: submission.value.email,
    redirectTo: submission.value.redirectTo,
    session,
  });
}

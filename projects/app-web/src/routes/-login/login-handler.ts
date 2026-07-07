import { redirect } from '@tanstack/react-router';
import { getRequestIP } from '@tanstack/react-start/server';
import type { z } from 'zod';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { SpamError } from '../../lib/auth/spam-error';
import { toSafeRedirectPath } from '../../lib/auth/to-safe-redirect-path';
import { updateAuthSession } from '../../lib/auth/update-auth-session';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { LoginFormSchema } from './login-form-schema';
import type { LoginResult } from './login-result';

/**
 * Runs the login form's submission: honeypot then field validation, a credential check, and — for
 * a caller with neither 2FA nor a competing live session — a completed sign-in. A 2FA-enabled
 * account or an already-live session ends in a redirect instead of a result, carrying just enough
 * verify-session state (the pending session's id) for the next step to complete it.
 */
export async function loginHandler(formData: FormData): Promise<LoginResult | Response> {
  await requireAnonymous();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') ?? undefined,
    rememberMe: formData.get('rememberMe') === 'on',
  });

  if (!submission.success) {
    return { fieldErrors: toFieldErrors(submission.error), status: 'invalid-fields' };
  }

  const user = await userClient.getUser({ email: submission.data.email });

  if (user === null) {
    return { status: 'invalid-credentials' };
  }

  const verified = await userClient.verifyPassword({
    email: submission.data.email,
    password: submission.data.password,
  });

  if (!verified.success) {
    return { status: 'invalid-credentials' };
  }

  const session = await sessionClient.createSession({
    ipAddress: getRequestIP() ?? '0.0.0.0',
    rememberMe: submission.data.rememberMe,
    userID: user.id,
  });

  const sessionBearerHeaders = { authorization: `Bearer ${session.id}` };

  const twoFactorVerification = await verificationClient.getVerification({
    target: user.id,
    type: '2fa',
  });

  if (twoFactorVerification !== null) {
    await updateVerifySession({ 'login2FA#sessionID': session.id });

    const searchParams = new URLSearchParams({ target: user.id, type: '2fa' });

    if (submission.data.redirectTo !== undefined) {
      searchParams.set('redirect', submission.data.redirectTo);
    }

    throw redirect({ href: `/verify-otp?${searchParams.toString()}` });
  }

  const otherSessions = await sessionClient.getSessions(
    {},
    { context: { headers: sessionBearerHeaders } },
  );

  if (otherSessions.some((other) => other.id !== session.id)) {
    await updateVerifySession({
      'loginLogout#email': submission.data.email,
      'loginLogout#sessionID': session.id,
    });

    throw redirect({ href: '/login/force-logout' });
  }

  const tokens = await sessionClient.verifySession(
    { id: session.id },
    { context: { headers: sessionBearerHeaders } },
  );

  await updateAuthSession(
    { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, sessionID: session.id },
    { expiresAt: session.expiresAt },
  );

  throw redirect({ href: toSafeRedirectPath(submission.data.redirectTo, '/') });
}

function toFieldErrors(error: z.ZodError): Partial<Record<'email' | 'password', string>> {
  const fieldErrors: Partial<Record<'email' | 'password', string>> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if ((field === 'email' || field === 'password') && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

import { safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { SpamError } from '../../lib/auth/spam-error';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { runVerification } from './run-verification';
import { VerifyOTPFormSchema } from './verify-otp-form-schema';
import type { VerifyOTPResult } from './verify-otp-result';

/**
 * Runs the verify-otp form's submission: honeypot then field validation, a code check, and the
 * matching verification type's continuation. Every declared error ends in the same form-level
 * message — there's only the one field to blame it on.
 */
export async function verifyOTPHandler(formData: FormData): Promise<VerifyOTPResult | Response> {
  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = VerifyOTPFormSchema.safeParse({
    code: formData.get('code'),
    redirect: formData.get('redirect') ?? undefined,
    target: formData.get('target'),
    type: formData.get('type'),
  });

  if (!submission.success) {
    return { formError: 'Invalid code', status: 'invalid-fields' };
  }

  // the 2fa login target must come from the pending session, not the form: a caller holding any
  // 2fa-enabled account could otherwise pass a code for that account while the session being
  // completed belongs to a different user
  let target = submission.data.target;

  if (submission.data.type === '2fa') {
    const verifySession = await getVerifySession();

    const boundTarget = verifySession['login2FA#target'];

    if (boundTarget === undefined) {
      throw redirect({ href: '/login' });
    }

    target = boundTarget;
  }

  const [verifyError] = await safe(
    verificationClient.verifyCode({
      code: submission.data.code,
      target,
      type: submission.data.type,
    }),
  );

  if (verifyError) {
    return { formError: 'Invalid or expired code', status: 'invalid-fields' };
  }

  return runVerification(submission.data.type, {
    redirectTo: submission.data.redirect,
    target,
  });
}

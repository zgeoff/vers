import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { SpamError } from '../../lib/auth/spam-error';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { runVerification } from './run-verification';
import { VerifyOTPFormSchema } from './verify-otp-form-schema';

/**
 * Runs the verify-otp form's submission: honeypot then field validation, a code check, and the
 * matching verification type's continuation. Every declared error ends in the same form-level
 * message — there's only the one field to blame it on. A successful `change-email` verify replies
 * instead of redirecting, so its caller can report success without a server-issued navigation.
 */
export async function verifyOTPHandler(formData: FormData): Promise<Response | SubmissionResult> {
  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: VerifyOTPFormSchema });

  if (submission.status !== 'success') {
    // every schema field's own message collapses to the one form-level error — there's only
    // the code field for a caller to fix, so a per-field message would be redundant noise
    return { ...submission.reply(), error: { '': ['Invalid code'] } };
  }

  // the 2fa login target must come from the pending session, not the form: a caller holding any
  // 2fa-enabled account could otherwise pass a code for that account while the session being
  // completed belongs to a different user
  let target = submission.value.target;

  if (submission.value.type === '2fa') {
    const verifySession = await getVerifySession();

    const boundTarget = verifySession['login2FA#target'];

    if (boundTarget === undefined) {
      throw redirect({ href: '/login' });
    }

    target = boundTarget;
  }

  const [verifyError] = await safe(
    verificationClient.verifyCode({
      code: submission.value.code,
      target,
      type: submission.value.type,
    }),
  );

  if (verifyError) {
    return submission.reply({ formErrors: ['Invalid or expired code'] });
  }

  // every type but `change-email` throws its own redirect before this line is reached
  await runVerification(submission.value.type, {
    redirectTo: submission.value.redirect,
    target,
  });

  return submission.reply();
}

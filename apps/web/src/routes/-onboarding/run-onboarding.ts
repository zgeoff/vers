import type { SubmissionResult } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { isDefinedError, safe } from '@orpc/client';
import { getRequestIP } from '@tanstack/react-start/server';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { runSessionSignIn } from '../../lib/auth/run-session-sign-in';
import { SpamError } from '../../lib/auth/spam-error';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { logger } from '../../server/logger';
import { OnboardingFormSchema } from './onboarding-form-schema';
import { requireOnboardingSession } from './require-onboarding-session';

export async function runOnboarding(formData: FormData): Promise<Response | SubmissionResult> {
  const onboardingSession = await requireOnboardingSession();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = parseWithZod(formData, { schema: OnboardingFormSchema });

  if (submission.status !== 'success') {
    return submission.reply();
  }

  const [error, user] = await safe(
    userClient.createUser({
      email: onboardingSession.email,
      name: submission.value.name,
      password: submission.value.password,
      username: submission.value.username,
    }),
  );

  if (error) {
    if (isDefinedError(error) && error.data.field === 'username') {
      return submission.reply({
        fieldErrors: { username: ['A user with that username already exists'] },
      });
    }

    logger.error({ err: error }, 'onboarding account creation failed');

    return submission.reply({ formErrors: ['Something went wrong. Please try again.'] });
  }

  const session = await sessionClient.createSession({
    ipAddress: getRequestIP() ?? '0.0.0.0',
    rememberMe: submission.value.rememberMe,
    userID: user.id,
  });

  await updateVerifySession({ 'onboarding#email': undefined });

  return runSessionSignIn({ email: user.email, session });
}

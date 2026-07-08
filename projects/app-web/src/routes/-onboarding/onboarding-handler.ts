import { isDefinedError, safe } from '@orpc/client';
import { getRequestIP } from '@tanstack/react-start/server';
import type { z } from 'zod';
import { checkHoneypot } from '../../lib/auth/check-honeypot';
import { completeSessionSignIn } from '../../lib/auth/complete-session-sign-in';
import { SpamError } from '../../lib/auth/spam-error';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import { OnboardingFormSchema } from './onboarding-form-schema';
import { requireOnboardingSession } from './require-onboarding-session';
import type { OnboardingResult } from './types';

type OnboardingFieldErrors = OnboardingResult['fieldErrors'];

/**
 * Runs the onboarding form's submission: honeypot then field validation, then account creation
 * for the email signup already verified. Completes the caller's first sign-in on success.
 */
export async function onboardingHandler(formData: FormData): Promise<OnboardingResult | Response> {
  const onboardingSession = await requireOnboardingSession();

  try {
    checkHoneypot(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      return new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }

  const submission = OnboardingFormSchema.safeParse({
    agreeToTerms: formData.get('agreeToTerms') === 'on',
    confirmPassword: formData.get('confirmPassword'),
    name: formData.get('name'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
    username: formData.get('username'),
  });

  if (!submission.success) {
    return { fieldErrors: toFieldErrors(submission.error), status: 'invalid-fields' };
  }

  const [error, user] = await safe(
    userClient.createUser({
      email: onboardingSession.email,
      name: submission.data.name,
      password: submission.data.password,
      username: submission.data.username,
    }),
  );

  if (error) {
    if (isDefinedError(error) && error.data.field === 'username') {
      return {
        fieldErrors: { username: 'A user with that username already exists' },
        status: 'invalid-fields',
      };
    }

    return { fieldErrors: {}, status: 'invalid-fields' };
  }

  const session = await sessionClient.createSession({
    ipAddress: getRequestIP() ?? '0.0.0.0',
    rememberMe: submission.data.rememberMe,
    userID: user.id,
  });

  await updateVerifySession({ 'onboarding#email': undefined });

  return completeSessionSignIn({ email: user.email, session });
}

function toFieldErrors(error: z.ZodError): OnboardingFieldErrors {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if (typeof field === 'string' && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

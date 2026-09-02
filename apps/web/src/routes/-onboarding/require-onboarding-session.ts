import { redirect } from '@tanstack/react-router';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

export interface OnboardingSession {
  readonly email: string;
}

export async function requireOnboardingSession(): Promise<OnboardingSession> {
  await requireAnonymous();

  const verifySession = await getVerifySession();

  const email = verifySession['onboarding#email'];

  if (email === undefined) {
    throw redirect({ href: '/signup' });
  }

  return { email };
}

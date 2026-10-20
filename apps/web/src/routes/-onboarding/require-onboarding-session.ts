import { redirect } from '@tanstack/react-router';
import type { SignupReason } from '../-signup/signup-search-schema';
import { readVerifySession } from '../../lib/auth/read-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

export interface OnboardingSession {
  readonly email: string;
}

export interface RequireOnboardingSessionOptions {
  readonly missingSessionReason?: SignupReason;
}

export async function requireOnboardingSession(
  options?: Readonly<RequireOnboardingSessionOptions>,
): Promise<OnboardingSession> {
  await requireAnonymous();

  const verifySession = await readVerifySession();

  const email = verifySession['onboarding#email'];

  if (email === undefined) {
    throw redirect({ href: buildSignupHref(options?.missingSessionReason) });
  }

  return { email };
}

function buildSignupHref(reason: SignupReason | undefined): string {
  if (reason === undefined) {
    return '/signup';
  }

  return `/signup?${new URLSearchParams({ reason }).toString()}`;
}

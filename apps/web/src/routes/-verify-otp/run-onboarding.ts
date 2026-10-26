import { redirect } from '@tanstack/react-router';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { VERIFY_SESSION_KEYS } from '../../lib/auth/verify-session-keys';
import type { RunVerificationContext } from './types';

export async function runOnboarding(ctx: Readonly<RunVerificationContext>): Promise<never> {
  await updateVerifySession({ [VERIFY_SESSION_KEYS.onboarding.email]: ctx.target });

  throw redirect({ href: '/onboarding' });
}

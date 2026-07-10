import { redirect } from '@tanstack/react-router';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import type { RunVerificationContext } from './types';

/**
 * Records the verified email so the onboarding page's guard can trust it, then sends the caller there.
 */
export async function runOnboarding(ctx: Readonly<RunVerificationContext>): Promise<never> {
  await updateVerifySession({ 'onboarding#email': ctx.target });

  throw redirect({ href: '/onboarding' });
}

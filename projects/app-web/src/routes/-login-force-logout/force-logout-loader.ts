import { redirect } from '@tanstack/react-router';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

/**
 * Bounces back to `/login` when this page is visited with no pending force-logout to confirm.
 */
export async function forceLogoutLoader(): Promise<void> {
  await requireAnonymous();

  const verifySession = await getVerifySession();

  if (
    verifySession['loginLogout#email'] === undefined ||
    verifySession['loginLogout#sessionID'] === undefined
  ) {
    throw redirect({ href: '/login' });
  }
}

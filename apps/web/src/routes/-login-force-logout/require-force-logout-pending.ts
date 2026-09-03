import { redirect } from '@tanstack/react-router';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

export async function requireForceLogoutPending(): Promise<void> {
  await requireAnonymous();

  const verifySession = await getVerifySession();

  if (
    verifySession['loginLogout#email'] === undefined ||
    verifySession['loginLogout#sessionID'] === undefined
  ) {
    throw redirect({ href: '/login' });
  }
}

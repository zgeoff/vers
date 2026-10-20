import { redirect } from '@tanstack/react-router';
import { readVerifySession } from '../../lib/auth/read-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

export async function requireForceLogoutPending(): Promise<void> {
  await requireAnonymous();

  const verifySession = await readVerifySession();

  if (
    verifySession['loginLogout#email'] === undefined ||
    verifySession['loginLogout#sessionID'] === undefined
  ) {
    throw redirect({ href: '/login' });
  }
}

import { redirect } from '@tanstack/react-router';
import { readVerifySession } from '../../lib/auth/read-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { VERIFY_SESSION_KEYS } from '../../lib/auth/verify-session-keys';

export async function requireForceLogoutPending(): Promise<void> {
  await requireAnonymous();

  const verifySession = await readVerifySession();

  if (
    verifySession[VERIFY_SESSION_KEYS.loginLogout.email] === undefined ||
    verifySession[VERIFY_SESSION_KEYS.loginLogout.sessionID] === undefined
  ) {
    throw redirect({ href: '/login' });
  }
}

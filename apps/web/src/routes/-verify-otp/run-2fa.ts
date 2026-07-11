import { redirect } from '@tanstack/react-router';
import { completeSessionSignIn } from '../../lib/auth/complete-session-sign-in';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

/**
 * Completes a 2FA-gated login: the pending session id login-handler stashed is looked up
 * alongside the account it belongs to, then finished exactly like a direct login would.
 */
export async function run2FA(ctx: Readonly<RunVerificationContext>): Promise<never> {
  const verifySession = await getVerifySession();

  const sessionID = verifySession['login2FA#sessionID'];

  if (sessionID === undefined) {
    throw redirect({ href: '/login' });
  }

  const [user, session] = await Promise.all([
    userClient.getUser({ id: ctx.target }),
    sessionClient.getSession({ id: sessionID }, { context: { actingUserID: ctx.target } }),
  ]);

  if (user === null || session === null || session.userID !== ctx.target) {
    throw redirect({ href: '/login' });
  }

  await updateVerifySession({
    'login2FA#sessionID': undefined,
    'login2FA#target': undefined,
  });

  return completeSessionSignIn({ email: user.email, redirectTo: ctx.redirectTo, session });
}

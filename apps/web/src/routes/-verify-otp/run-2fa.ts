import { redirect } from '@tanstack/react-router';
import { readVerifySession } from '../../lib/auth/read-verify-session';
import { runSessionSignIn } from '../../lib/auth/run-session-sign-in';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { VERIFY_SESSION_KEYS } from '../../lib/auth/verify-session-keys';
import { sessionClient } from '../../lib/rpc/clients/session-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

export async function run2FA(ctx: Readonly<RunVerificationContext>): Promise<never> {
  const verifySession = await readVerifySession();

  const sessionID = verifySession[VERIFY_SESSION_KEYS.login2FA.sessionID];

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
    [VERIFY_SESSION_KEYS.login2FA.sessionID]: undefined,
    [VERIFY_SESSION_KEYS.login2FA.target]: undefined,
  });

  return runSessionSignIn({ email: user.email, redirectTo: ctx.redirectTo, session });
}

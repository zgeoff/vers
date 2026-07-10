import { redirect } from '@tanstack/react-router';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import type { VerifySessionData } from '../../lib/auth/types';
import { updateAuthSession } from '../../lib/auth/update-auth-session';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';

const CLEAR_PENDING_SESSION: VerifySessionData = {
  'loginLogout#email': undefined,
  'loginLogout#sessionID': undefined,
  'loginLogout#userID': undefined,
};

/**
 * Runs the force-logout page's confirm/cancel choice. Confirming completes the pending sign-in
 * exactly like a direct login would — `verifySession` itself signs out every other live session
 * for the account; cancelling, or a request with no pending state left to act on, just clears the
 * verify-session cookie and sends the caller back.
 */
export async function forceLogoutHandler(formData: FormData): Promise<never> {
  await requireAnonymous();

  const intent = formData.get('intent');

  const verifySession = await getVerifySession();

  const sessionID = verifySession['loginLogout#sessionID'];
  const actingUserID = verifySession['loginLogout#userID'];

  if (intent !== 'confirm' || sessionID === undefined || actingUserID === undefined) {
    await updateVerifySession(CLEAR_PENDING_SESSION);

    throw redirect({ href: '/' });
  }

  const session = await sessionClient.getSession({ id: sessionID }, { context: { actingUserID } });

  const tokens = await sessionClient.verifySession(
    { id: sessionID },
    { context: { actingUserID } },
  );

  await updateVerifySession(CLEAR_PENDING_SESSION);

  const updateOptions = session === null ? {} : { expiresAt: session.expiresAt };

  await updateAuthSession(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionID,
      userID: actingUserID,
    },
    updateOptions,
  );

  throw redirect({ href: '/' });
}

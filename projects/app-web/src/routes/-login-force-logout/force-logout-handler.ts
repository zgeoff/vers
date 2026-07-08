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
};

/**
 * Runs the force-logout page's confirm/cancel choice. Confirming signs out every other live
 * session for the pending sign-in's account, then completes it exactly like a direct login would;
 * cancelling — or a request with no pending state left to act on — just clears the verify-session
 * cookie and sends the caller back.
 */
export async function forceLogoutHandler(formData: FormData): Promise<never> {
  await requireAnonymous();

  const intent = formData.get('intent');

  const verifySession = await getVerifySession();

  const sessionID = verifySession['loginLogout#sessionID'];

  if (intent !== 'confirm' || sessionID === undefined) {
    await updateVerifySession(CLEAR_PENDING_SESSION);

    throw redirect({ href: '/' });
  }

  const sessionBearerHeaders = { authorization: `Bearer ${sessionID}` };

  const otherSessions = await sessionClient.getSessions(
    {},
    { context: { headers: sessionBearerHeaders } },
  );

  await Promise.all(
    otherSessions
      .filter((other) => other.id !== sessionID)
      .map((other) =>
        sessionClient.deleteSession(
          { id: other.id },
          { context: { headers: sessionBearerHeaders } },
        ),
      ),
  );

  const session = await sessionClient.getSession(
    { id: sessionID },
    { context: { headers: sessionBearerHeaders } },
  );

  const tokens = await sessionClient.verifySession(
    { id: sessionID },
    { context: { headers: sessionBearerHeaders } },
  );

  await updateVerifySession(CLEAR_PENDING_SESSION);

  const updateOptions = session === null ? {} : { expiresAt: session.expiresAt };

  await updateAuthSession(
    { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, sessionID },
    updateOptions,
  );

  throw redirect({ href: '/' });
}

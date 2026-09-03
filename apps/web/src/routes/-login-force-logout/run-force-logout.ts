import { redirect } from '@tanstack/react-router';
import { getVerifySession } from '../../lib/auth/get-verify-session';
import { requireAnonymous } from '../../lib/auth/require-anonymous';
import { toSafeRedirectPath } from '../../lib/auth/to-safe-redirect-path';
import type { VerifySessionData } from '../../lib/auth/types';
import { updateAuthSession } from '../../lib/auth/update-auth-session';
import { updateVerifySession } from '../../lib/auth/update-verify-session';
import { sessionClient } from '../../lib/rpc/clients/session-client';

const CLEAR_PENDING_SESSION: VerifySessionData = {
  'loginLogout#email': undefined,
  'loginLogout#redirect': undefined,
  'loginLogout#sessionID': undefined,
  'loginLogout#userID': undefined,
};

export async function runForceLogout(formData: FormData): Promise<never> {
  await requireAnonymous();

  const intent = formData.get('intent');

  const verifySession = await getVerifySession();

  const sessionID = verifySession['loginLogout#sessionID'];
  const actingUserID = verifySession['loginLogout#userID'];
  const redirectTo = verifySession['loginLogout#redirect'];

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

  throw redirect({ href: toSafeRedirectPath(redirectTo, '/respite') });
}

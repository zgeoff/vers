import { redirect } from '@tanstack/react-router';
import { sessionClient } from '../rpc/clients/session-client';
import { toSafeRedirectPath } from './to-safe-redirect-path';
import { updateAuthSession } from './update-auth-session';
import { updateVerifySession } from './update-verify-session';

interface RunSessionSignInOptions {
  readonly email: string;
  readonly redirectTo?: string | undefined;
  readonly session: { readonly expiresAt: Date; readonly id: string; readonly userID: string };
}

/**
 * Finishes signing a caller in once credential or code verification has already cleared: a
 * concurrent live session for the account ends in a force-logout redirect carrying just the
 * pending session's id and owner, otherwise the session is verified directly and the auth cookie is
 * set.
 */
export async function runSessionSignIn(opts: Readonly<RunSessionSignInOptions>): Promise<never> {
  const actingUserID = opts.session.userID;

  const otherSessions = await sessionClient.getSessions({}, { context: { actingUserID } });

  if (otherSessions.some((other) => other.id !== opts.session.id)) {
    await updateVerifySession({
      'loginLogout#email': opts.email,
      'loginLogout#redirect': opts.redirectTo,
      'loginLogout#sessionID': opts.session.id,
      'loginLogout#userID': actingUserID,
    });

    throw redirect({ href: '/login/force-logout' });
  }

  const tokens = await sessionClient.verifySession(
    { id: opts.session.id },
    { context: { actingUserID } },
  );

  await updateAuthSession(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionID: opts.session.id,
      userID: actingUserID,
    },
    { expiresAt: opts.session.expiresAt },
  );

  throw redirect({ href: toSafeRedirectPath(opts.redirectTo, '/avatars') });
}

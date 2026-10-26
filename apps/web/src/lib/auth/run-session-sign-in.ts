import { redirect } from '@tanstack/react-router';
import { sessionClient } from '../rpc/clients/session-client';
import { toSafeRedirectPath } from './to-safe-redirect-path';
import { updateAuthSession } from './update-auth-session';
import { updateVerifySession } from './update-verify-session';
import { VERIFY_SESSION_KEYS } from './verify-session-keys';

interface RunSessionSignInOptions {
  readonly email: string;
  readonly redirectTo?: string | undefined;
  readonly session: { readonly expiresAt: Date; readonly id: string; readonly userID: string };
}

export async function runSessionSignIn(opts: Readonly<RunSessionSignInOptions>): Promise<never> {
  const actingUserID = opts.session.userID;

  const otherSessions = await sessionClient.getSessions({}, { context: { actingUserID } });

  if (otherSessions.some((other) => other.id !== opts.session.id)) {
    await updateVerifySession({
      [VERIFY_SESSION_KEYS.loginLogout.email]: opts.email,
      [VERIFY_SESSION_KEYS.loginLogout.redirect]: opts.redirectTo,
      [VERIFY_SESSION_KEYS.loginLogout.sessionID]: opts.session.id,
      [VERIFY_SESSION_KEYS.loginLogout.userID]: actingUserID,
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

  throw redirect({ href: toSafeRedirectPath(opts.redirectTo, '/respite') });
}

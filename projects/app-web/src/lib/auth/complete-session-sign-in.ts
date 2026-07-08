import { redirect } from '@tanstack/react-router';
import { sessionClient } from '../rpc/clients/session-client';
import { toSafeRedirectPath } from './to-safe-redirect-path';
import { updateAuthSession } from './update-auth-session';
import { updateVerifySession } from './update-verify-session';

interface CompleteSessionSignInOptions {
  readonly email: string;
  readonly redirectTo?: string | undefined;
  readonly session: { readonly expiresAt: Date; readonly id: string };
}

/**
 * Finishes signing a caller in once credential or code verification has already cleared: a
 * concurrent live session for the account ends in a force-logout redirect carrying just the
 * pending session's id, otherwise the session is verified directly and the auth cookie is set.
 */
export async function completeSessionSignIn(
  opts: Readonly<CompleteSessionSignInOptions>,
): Promise<never> {
  const sessionBearerHeaders = { authorization: `Bearer ${opts.session.id}` };

  const otherSessions = await sessionClient.getSessions(
    {},
    { context: { headers: sessionBearerHeaders } },
  );

  if (otherSessions.some((other) => other.id !== opts.session.id)) {
    await updateVerifySession({
      'loginLogout#email': opts.email,
      'loginLogout#sessionID': opts.session.id,
    });

    throw redirect({ href: '/login/force-logout' });
  }

  const tokens = await sessionClient.verifySession(
    { id: opts.session.id },
    { context: { headers: sessionBearerHeaders } },
  );

  await updateAuthSession(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionID: opts.session.id,
    },
    { expiresAt: opts.session.expiresAt },
  );

  throw redirect({ href: toSafeRedirectPath(opts.redirectTo, '/') });
}

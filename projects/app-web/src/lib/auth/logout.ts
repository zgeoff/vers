import { redirect } from '@tanstack/react-router';
import { sessionClient } from '../rpc/clients/session-client';
import { clearAuthSession } from './clear-auth-session';
import { getAuthSession } from './get-auth-session';
import { toSafeRedirectPath } from './to-safe-redirect-path';

export interface LogoutOptions {
  readonly deleteSession?: boolean;
  readonly redirectTo?: string;
}

/**
 * Ends the caller's session: best-effort deletes it server-side, always clears the `en_session`
 * cookie, then redirects. A failed server-side delete never blocks sign-out — the cookie clear is
 * what actually signs the caller out of this app.
 */
export async function logout(options: LogoutOptions = {}): Promise<never> {
  const session = await getAuthSession();

  if (options.deleteSession === true && session.sessionID !== undefined) {
    const sessionID = session.sessionID;

    await sessionClient
      .deleteSession(
        { id: sessionID },
        { context: { headers: { authorization: `Bearer ${sessionID}` } } },
      )
      .catch(() => {});
  }

  await clearAuthSession();

  throw redirect({ href: toSafeRedirectPath(options.redirectTo, '/') });
}

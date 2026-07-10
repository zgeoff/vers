import { getRequestUrl } from '@tanstack/react-start/server';
import { getAuthSession } from './get-auth-session';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect';
import { logout } from './logout';

interface AuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionID: string;
}

/**
 * Gates a route to signed-in callers. A missing or partial auth session ends in a forced logout
 * (clearing whatever partial cookie state remains) redirecting back to `/login` with a `redirect`
 * query param pointing at the page the caller was trying to reach.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getAuthSession();

  if (
    session.sessionID === undefined ||
    session.accessToken === undefined ||
    session.refreshToken === undefined
  ) {
    await logout({ redirectTo: getLoginPathWithRedirect(getRequestUrl()) });

    throw new Error('unreachable: logout always throws a redirect');
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    sessionID: session.sessionID,
  };
}

import { getRequestUrl } from '@tanstack/react-start/server';
import { getAuthSession } from './get-auth-session';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect';
import { runLogout } from './run-logout';

interface AuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionID: string;
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await getAuthSession();

  if (
    session.sessionID === undefined ||
    session.accessToken === undefined ||
    session.refreshToken === undefined
  ) {
    await runLogout({ redirectTo: getLoginPathWithRedirect(getRequestUrl()) });

    throw new Error('unreachable: logout always throws a redirect');
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    sessionID: session.sessionID,
  };
}

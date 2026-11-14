import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server';
import { getLoginPathForRequest } from './get-login-path-for-request';
import { readAuthSession } from './read-auth-session';
import { runLogout } from './run-logout';

interface AuthResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly sessionID: string;
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await readAuthSession();

  if (
    session.sessionID === undefined ||
    session.accessToken === undefined ||
    session.refreshToken === undefined
  ) {
    await runLogout({
      redirectTo: getLoginPathForRequest(getRequestUrl(), getRequestHeader('referer')),
    });

    throw new Error('unreachable: logout always throws a redirect');
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    sessionID: session.sessionID,
  };
}

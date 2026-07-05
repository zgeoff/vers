import { UnreachableCodeError } from '@vers/utils';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect.server';
import { logout } from './logout.server';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  sessionID: string;
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  const authSession = await authSessionStorage.getSession(request.headers.get('cookie'));

  const sessionID = authSession.get('sessionID');
  const accessToken = authSession.get('accessToken');
  const refreshToken = authSession.get('refreshToken');

  if (!sessionID || !accessToken || !refreshToken) {
    await logout(request, { redirectTo: getLoginPathWithRedirect(request) });

    throw new UnreachableCodeError('logout throws a redirect');
  }

  return { accessToken, refreshToken, sessionID };
}

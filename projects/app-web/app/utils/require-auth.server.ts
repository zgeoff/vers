import { UnreachableCodeError } from '@vers/utils';
import { authSessionStorage } from '../session/auth-session-storage.server';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect.server';
import { logout } from './logout.server';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  sessionID: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function requireAuth(request: Request): Promise<AuthResult> {
  const authSession = await authSessionStorage.getSession(request.headers.get('cookie'));

  const sessionID = authSession.get('sessionID');
  const accessToken = authSession.get('accessToken');
  const refreshToken = authSession.get('refreshToken');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (!sessionID || !accessToken || !refreshToken) {
    await logout(request, { redirectTo: getLoginPathWithRedirect(request) });

    throw new UnreachableCodeError('logout throws a redirect');
  }

  return { accessToken, refreshToken, sessionID };
}

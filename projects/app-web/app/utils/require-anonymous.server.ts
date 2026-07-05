import { redirect } from 'react-router';
import { authSessionStorage } from '../session/auth-session-storage.server';
import { Routes } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function requireAnonymous(request: Request) {
  const authSession = await authSessionStorage.getSession(request.headers.get('cookie'));

  const sessionID = authSession.get('sessionID');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (sessionID) {
    throw redirect(Routes.Nexus);
  }
}

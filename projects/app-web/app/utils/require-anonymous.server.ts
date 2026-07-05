import { redirect } from 'react-router';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { Routes } from '~/types';

export async function requireAnonymous(request: Request) {
  const authSession = await authSessionStorage.getSession(request.headers.get('cookie'));

  const sessionID = authSession.get('sessionID');

  if (sessionID) {
    throw redirect(Routes.Nexus);
  }
}

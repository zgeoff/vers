import { getSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  readAuthSessionConfig,
} from './read-auth-session-config';
import type { AuthSessionData } from './types';

export async function readAuthSession(): Promise<AuthSessionData> {
  const session = await getSession<AuthSessionData>(
    readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS),
  );

  return session.data;
}

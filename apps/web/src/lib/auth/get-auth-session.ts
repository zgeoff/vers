import { getSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';
import type { AuthSessionData } from './types';

export async function getAuthSession(): Promise<AuthSessionData> {
  const session = await getSession<AuthSessionData>(
    buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS),
  );

  return session.data;
}

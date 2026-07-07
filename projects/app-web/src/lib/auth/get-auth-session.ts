import { getSession } from '@tanstack/react-start/server';
import type { AuthSessionData } from './auth-session-data';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';

/**
 * Reads the caller's auth session. Never throws for a missing or expired cookie — an absent
 * `accessToken`/`sessionID` is how callers (`requireAuth`, `requireAnonymous`) observe "signed
 * out".
 */
export async function getAuthSession(): Promise<AuthSessionData> {
  const session = await getSession<AuthSessionData>(
    buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS),
  );

  return session.data;
}

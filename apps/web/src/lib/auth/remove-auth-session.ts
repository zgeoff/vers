import { clearSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';

/**
 * Clears the auth session, deleting the `en_session` cookie.
 */
export async function removeAuthSession(): Promise<void> {
  await clearSession(buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS));
}

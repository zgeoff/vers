import { clearSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';

export async function removeAuthSession(): Promise<void> {
  await clearSession(buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS));
}

import { clearSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  readAuthSessionConfig,
} from './read-auth-session-config';

export async function removeAuthSession(): Promise<void> {
  await clearSession(readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS));
}

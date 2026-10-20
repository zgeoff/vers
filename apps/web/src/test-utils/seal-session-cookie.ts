import { H3Event, sealSession, updateSession } from 'h3';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  readAuthSessionConfig,
} from '../lib/auth/read-auth-session-config';
import type { AuthSessionData } from '../lib/auth/types';

export async function sealSessionCookie(data: AuthSessionData): Promise<string> {
  const config = readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS);

  const event = new H3Event(new Request('https://example.test/'));

  await updateSession(event, config, { ...data });

  return sealSession(event, config);
}

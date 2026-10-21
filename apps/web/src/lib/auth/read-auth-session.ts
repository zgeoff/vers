import { getIronSession } from 'iron-session';
import { createSessionCookieJar } from './create-session-cookie-jar';
import { parseAuthSessionData } from './parse-auth-session-data';
import {
  AUTH_SESSION_DEFAULT_TTL_SECONDS,
  readAuthSessionConfig,
} from './read-auth-session-config';
import type { AuthSessionData } from './types';

export async function readAuthSession(): Promise<AuthSessionData> {
  const session = await getIronSession(
    createSessionCookieJar(),
    readAuthSessionConfig(AUTH_SESSION_DEFAULT_TTL_SECONDS),
  );

  return parseAuthSessionData(session);
}

import { getIronSession } from 'iron-session';
import { createSessionCookieJar } from './create-session-cookie-jar';
import {
  AUTH_SESSION_DEFAULT_TTL_SECONDS,
  readAuthSessionConfig,
} from './read-auth-session-config';

export async function removeAuthSession(): Promise<void> {
  const session = await getIronSession(
    createSessionCookieJar(),
    readAuthSessionConfig(AUTH_SESSION_DEFAULT_TTL_SECONDS),
  );

  session.destroy();
}

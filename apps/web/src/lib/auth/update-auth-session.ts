import { getIronSession } from 'iron-session';
import { createSessionCookieJar } from './create-session-cookie-jar';
import { parseAuthSessionData } from './parse-auth-session-data';
import {
  AUTH_SESSION_DEFAULT_TTL_SECONDS,
  readAuthSessionConfig,
} from './read-auth-session-config';
import type { AuthSessionData } from './types';
import { writeSessionData } from './write-session-data';

interface UpdateAuthSessionOptions {
  readonly expiresAt?: Date;
}

export async function updateAuthSession(
  update: Partial<AuthSessionData>,
  opts?: UpdateAuthSessionOptions,
): Promise<AuthSessionData> {
  const session = await getIronSession<AuthSessionData>(
    createSessionCookieJar(),
    readAuthSessionConfig(AUTH_SESSION_DEFAULT_TTL_SECONDS),
  );

  const current = parseAuthSessionData(session);
  const expires = opts?.expiresAt?.toISOString() ?? current.expires;

  const data: AuthSessionData = {
    ...current,
    ...update,
    ...(expires !== undefined && { expires }),
  };

  // measured to the stored expiry, never a fresh window from now: an unrelated field update later
  // in the session's life must not extend how long the cookie stays valid
  const ttl =
    expires === undefined
      ? AUTH_SESSION_DEFAULT_TTL_SECONDS
      : Math.floor((new Date(expires).getTime() - Date.now()) / 1000);

  // iron-session reads a ttl of 0 as a seal that never expires, so an expired session is
  // destroyed rather than saved
  if (ttl <= 0) {
    session.destroy();

    return {};
  }

  await writeSessionData(session, data, readAuthSessionConfig(ttl));

  return data;
}

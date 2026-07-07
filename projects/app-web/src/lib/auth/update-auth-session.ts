import { getSession, updateSession } from '@tanstack/react-start/server';
import type { AuthSessionData } from './auth-session-data';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';

export interface UpdateAuthSessionOptions {
  readonly expiresAt?: Date;
}

/**
 * Writes to the auth session cookie. The cookie's actual `Max-Age` always resolves to the
 * `expiresAt` a caller set on some earlier call (or `opts.expiresAt` now) measured from the
 * session's own creation time — never a fresh window from "now" — so an unrelated field update
 * later in the session's life can't silently extend how long it stays valid.
 */
export async function updateAuthSession(
  update: Partial<AuthSessionData>,
  opts?: UpdateAuthSessionOptions,
): Promise<AuthSessionData> {
  const current = await getSession<AuthSessionData>(
    buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS),
  );

  const expires = opts?.expiresAt?.toISOString() ?? current.data.expires;

  const maxAge =
    expires === undefined
      ? AUTH_SESSION_READ_MAX_AGE_SECONDS
      : Math.max(0, Math.round((new Date(expires).getTime() - current.createdAt) / 1000));

  const session = await updateSession<AuthSessionData>(buildAuthSessionConfig(maxAge), {
    ...update,
    ...(expires !== undefined && { expires }),
  });

  return session.data;
}

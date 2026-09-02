import { getSession, updateSession } from '@tanstack/react-start/server';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from './build-auth-session-config';
import type { AuthSessionData } from './types';

interface UpdateAuthSessionOptions {
  readonly expiresAt?: Date;
}

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

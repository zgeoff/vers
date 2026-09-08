import type { getSession } from '@tanstack/react-start/server';
import { readSessionSecret } from './read-session-secret';

export type SessionConfig = Parameters<typeof getSession>[0];

export const AUTH_SESSION_READ_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function buildAuthSessionConfig(maxAge: number): SessionConfig {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    cookie: {
      ...(domain !== undefined && { domain }),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',

      // secure cookies only transmit over https — except on localhost, which browsers treat as
      // a secure context, so a local production build still sends them
      secure: process.env.NODE_ENV === 'production',
    },
    maxAge,
    name: 'en_session',
    password: readSessionSecret(),
  };
}

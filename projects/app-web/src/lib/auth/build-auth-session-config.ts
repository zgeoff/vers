import type { getSession } from '@tanstack/react-start/server';
import { readSessionSecret } from './read-session-secret';

/** `getSession`'s config parameter type, without a direct dependency on its owning package. */
export type SessionConfig = Parameters<typeof getSession>[0];

/** A generous ceiling for reads: real expiry is enforced by comparing `data.expires` to now. */
export const AUTH_SESSION_READ_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Builds the `en_session` cookie's session config; `maxAge` governs the emitted `Max-Age`. */
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

import type { SessionOptions } from 'iron-session';
import { handleUnsealError } from './handle-unseal-error';
import { readSessionSecret } from './read-session-secret';

export const AUTH_SESSION_DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

export function readAuthSessionConfig(ttl: number): SessionOptions {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    cookieName: 'en_session',
    cookieOptions: {
      ...(domain !== undefined && { domain }),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',

      // secure cookies only transmit over https — except on localhost, which browsers treat as
      // a secure context, so a local production build still sends them
      secure: process.env.NODE_ENV === 'production',
    },
    onUnsealError: handleUnsealError,
    password: readSessionSecret(),
    ttl,
  };
}

import type { SessionOptions } from 'iron-session';
import { handleUnsealError } from './handle-unseal-error';
import { readSessionSecret } from './read-session-secret';

export const VERIFY_SESSION_TTL_SECONDS = 60 * 10;

export function readVerifySessionConfig(): SessionOptions {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    cookieName: 'en_verification',
    cookieOptions: {
      ...(domain !== undefined && { domain }),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    onUnsealError: handleUnsealError,
    password: readSessionSecret(),
    ttl: VERIFY_SESSION_TTL_SECONDS,
  };
}

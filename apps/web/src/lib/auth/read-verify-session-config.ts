import type { SessionConfig } from './read-auth-session-config';
import { readSessionSecret } from './read-session-secret';

const VERIFY_SESSION_MAX_AGE_SECONDS = 60 * 10;

export function readVerifySessionConfig(): SessionConfig {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    cookie: {
      ...(domain !== undefined && { domain }),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    maxAge: VERIFY_SESSION_MAX_AGE_SECONDS,
    name: 'en_verification',
    password: readSessionSecret(),
  };
}

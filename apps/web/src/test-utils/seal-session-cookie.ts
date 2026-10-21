import { sealData } from 'iron-session';
import { AUTH_SESSION_DEFAULT_TTL_SECONDS } from '../lib/auth/read-auth-session-config';
import { readSessionSecret } from '../lib/auth/read-session-secret';
import type { AuthSessionData } from '../lib/auth/types';

export function sealSessionCookie(data: AuthSessionData): Promise<string> {
  return sealData(data, { password: readSessionSecret(), ttl: AUTH_SESSION_DEFAULT_TTL_SECONDS });
}

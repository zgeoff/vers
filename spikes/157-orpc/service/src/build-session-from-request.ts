import type { SessionResolution } from './types';

/**
 * Resolves a session token from the `authorization` header (`Bearer <token>`) or the `session`
 * cookie. Spike-grade stand-in for real session verification: one hard-coded valid token, one
 * hard-coded expired token, everything else counts as no session.
 */
export function buildSessionFromRequest(request: Request): SessionResolution {
  const token = findToken(request);
  if (token === null) return { failure: 'missing-session' };
  if (token === 'expired-session-token') return { failure: 'expired-session' };
  if (token === 'dev-session-token') return { userId: 'user-1' };
  return { failure: 'missing-session' };
}

function findToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer '))
    return authorization.slice('Bearer '.length);
  const cookie = request.headers.get('cookie');
  const match = cookie?.match(/(?:^|;\s*)session=([^;]+)/);
  return match?.[1] ?? null;
}

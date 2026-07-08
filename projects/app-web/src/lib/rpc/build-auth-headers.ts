import type { AuthSessionData } from '../auth/types';

/** Builds bearer and session-id headers from a session; empty when the session isn't live. */
export function buildAuthHeaders(session: AuthSessionData): Record<string, string> {
  if (session.accessToken === undefined || session.sessionID === undefined) {
    return {};
  }

  return { authorization: `Bearer ${session.accessToken}`, 'x-session-id': session.sessionID };
}

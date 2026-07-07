import { getAuthSession } from '../auth/get-auth-session';

/** Builds the caller's own session headers from the `en_session` cookie, when one is live. */
export async function attachAuthHeaders(): Promise<Record<string, string>> {
  const session = await getAuthSession();

  if (session.accessToken === undefined || session.sessionID === undefined) {
    return {};
  }

  return { authorization: `Bearer ${session.accessToken}`, 'x-session-id': session.sessionID };
}

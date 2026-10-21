import { getIronSession, webCookies } from 'iron-session';
import type { SessionOptions } from 'iron-session';
import { parseAuthSessionData } from '../lib/auth/parse-auth-session-data';

export async function readSessionID(
  request: Request,
  config: Readonly<SessionOptions>,
): Promise<string | null> {
  // the jar only reads here: no session is saved, so nothing lands on the throwaway headers
  const session = await getIronSession(webCookies(request, new Headers()), config);

  const sessionID = parseAuthSessionData(session).sessionID;

  return sessionID === undefined || sessionID === '' ? null : sessionID;
}

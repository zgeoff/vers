import { getIronSession } from 'iron-session';
import { createSessionCookieJar } from './create-session-cookie-jar';
import { parseVerifySessionData } from './parse-verify-session-data';
import { readVerifySessionConfig } from './read-verify-session-config';
import type { VerifySessionData } from './types';

export async function readVerifySession(): Promise<VerifySessionData> {
  const session = await getIronSession(createSessionCookieJar(), readVerifySessionConfig());

  return parseVerifySessionData(session);
}

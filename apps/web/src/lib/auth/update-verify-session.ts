import { getIronSession } from 'iron-session';
import { createSessionCookieJar } from './create-session-cookie-jar';
import { parseVerifySessionData } from './parse-verify-session-data';
import { readVerifySessionConfig } from './read-verify-session-config';
import type { VerifySessionData } from './types';
import { writeSessionData } from './write-session-data';

export async function updateVerifySession(update: VerifySessionData): Promise<VerifySessionData> {
  const config = readVerifySessionConfig();

  const session = await getIronSession<VerifySessionData>(createSessionCookieJar(), config);

  const data = parseVerifySessionData({ ...parseVerifySessionData(session), ...update });

  await writeSessionData(session, data, config);

  return data;
}

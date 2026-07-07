import { getSession } from '@tanstack/react-start/server';
import { buildVerifySessionConfig } from './build-verify-session-config';
import type { VerifySessionData } from './verify-session-data';

/** Reads the caller's in-flight verification state; empty once the 10-minute window lapses. */
export async function getVerifySession(): Promise<VerifySessionData> {
  const session = await getSession<VerifySessionData>(buildVerifySessionConfig());

  return session.data;
}

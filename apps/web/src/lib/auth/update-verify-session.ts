import { updateSession } from '@tanstack/react-start/server';
import { buildVerifySessionConfig } from './build-verify-session-config';
import type { VerifySessionData } from './types';

/**
 * Writes to the in-flight verification state; an explicit `undefined` value clears that key.
 */
export async function updateVerifySession(update: VerifySessionData): Promise<VerifySessionData> {
  const session = await updateSession<VerifySessionData>(buildVerifySessionConfig(), update);

  return session.data;
}

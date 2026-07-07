import { updateSession } from '@tanstack/react-start/server';
import { buildVerifySessionConfig } from './build-verify-session-config';
import type { VerifySessionData, VerifySessionUpdate } from './verify-session-data';

/** Writes to the in-flight verification state; an explicit `undefined` value clears that key. */
export async function updateVerifySession(update: VerifySessionUpdate): Promise<VerifySessionData> {
  const session = await updateSession<VerifySessionData>(
    buildVerifySessionConfig(),
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- bridges this module's explicit-undefined "clear a key" convenience shape onto the session framework's own Partial<T> update parameter
    update as Partial<VerifySessionData>,
  );

  return session.data;
}

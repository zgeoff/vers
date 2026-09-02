import { updateSession } from '@tanstack/react-start/server';
import { buildVerifySessionConfig } from './build-verify-session-config';
import type { VerifySessionData } from './types';

export async function updateVerifySession(update: VerifySessionData): Promise<VerifySessionData> {
  const session = await updateSession<VerifySessionData>(buildVerifySessionConfig(), update);

  return session.data;
}

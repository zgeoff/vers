import { updateSession } from '@tanstack/react-start/server';
import { readVerifySessionConfig } from './read-verify-session-config';
import type { VerifySessionData } from './types';

export async function updateVerifySession(update: VerifySessionData): Promise<VerifySessionData> {
  const session = await updateSession<VerifySessionData>(readVerifySessionConfig(), update);

  return session.data;
}

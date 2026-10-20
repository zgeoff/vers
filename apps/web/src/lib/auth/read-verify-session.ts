import { getSession } from '@tanstack/react-start/server';
import { readVerifySessionConfig } from './read-verify-session-config';
import type { VerifySessionData } from './types';

export async function readVerifySession(): Promise<VerifySessionData> {
  const session = await getSession<VerifySessionData>(readVerifySessionConfig());

  return session.data;
}

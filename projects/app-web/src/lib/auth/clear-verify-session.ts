import { clearSession } from '@tanstack/react-start/server';
import { buildVerifySessionConfig } from './build-verify-session-config';

/** Clears every in-flight flow's state, deleting the `en_verification` cookie. */
export async function clearVerifySession(): Promise<void> {
  await clearSession(buildVerifySessionConfig());
}

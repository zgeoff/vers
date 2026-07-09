import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

/**
 * Confirms ownership of a new email address and applies it to the caller's own account. Returns
 * instead of throwing a redirect, leaving navigation to the caller.
 */
export async function runChangeEmail(ctx: Readonly<RunVerificationContext>): Promise<void> {
  await userClient.updateEmail({ email: ctx.target });
}

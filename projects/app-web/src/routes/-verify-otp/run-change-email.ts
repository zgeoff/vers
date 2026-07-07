import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

/**
 * Confirms ownership of a new email address and applies it to the caller's own account. Returns
 * rather than throwing a redirect: the caller already knows the account hub is where this lands,
 * and reports success without a server-issued redirect so the hub can refresh in place.
 */
export async function runChangeEmail(ctx: Readonly<RunVerificationContext>): Promise<void> {
  await userClient.updateEmail({ email: ctx.target });
}

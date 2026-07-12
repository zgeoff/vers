import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

/**
 * Confirms ownership of a new email address and applies it to the caller's own account, then
 * notifies the old address of the change. Captures the old address before applying the mutation,
 * since `getCurrentUser` would otherwise see the new one. Returns instead of throwing a redirect,
 * leaving navigation to the caller.
 */
export async function runChangeEmail(ctx: Readonly<RunVerificationContext>): Promise<void> {
  const user = await userClient.getCurrentUser({});

  await userClient.updateEmail({ email: ctx.target });
  await emailClient.sendChangeEmailNotification({ to: user.email });
}

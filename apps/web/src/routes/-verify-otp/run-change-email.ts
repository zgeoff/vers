import { emailClient } from '../../lib/rpc/clients/email-client';
import { userClient } from '../../lib/rpc/clients/user-client';
import type { RunVerificationContext } from './types';

export async function runChangeEmail(ctx: Readonly<RunVerificationContext>): Promise<void> {
  const user = await userClient.getCurrentUser({});

  await userClient.updateEmail({ email: ctx.target });
  await emailClient.sendChangeEmailNotification({ to: user.email });
}

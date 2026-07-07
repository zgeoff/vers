import { redirect } from '@tanstack/react-router';
import { userClient } from '../../lib/rpc/clients/user-client';
import type { HandleVerificationContext } from './handle-verification-context';

/** Confirms ownership of a new email address and applies it to the caller's own account. */
export async function handleChangeEmail(ctx: Readonly<HandleVerificationContext>): Promise<never> {
  await userClient.updateEmail({ email: ctx.target });

  throw redirect({ href: '/account' });
}

import { redirect } from '@tanstack/react-router';
import { requireAnonymous } from '../../lib/auth/require-anonymous';

export interface ResetPasswordAccess {
  readonly email: string;
  readonly resetToken: string;
}

/**
 * Gates the reset-password page on the emailed link's `email`/`token` query params.
 */
export async function requireResetPasswordAccess(
  search: Readonly<Record<string, unknown>>,
): Promise<ResetPasswordAccess> {
  await requireAnonymous();

  const email = search['email'];
  const resetToken = search['token'];

  if (typeof email !== 'string' || typeof resetToken !== 'string') {
    throw redirect({ href: '/login' });
  }

  return { email, resetToken };
}

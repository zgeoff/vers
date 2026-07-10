import { createHash, randomBytes } from 'node:crypto';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * oRPC handler opts for the `createPasswordResetToken` procedure.
 */
interface CreatePasswordResetTokenOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly NO_PASSWORD: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Mints a password-reset token, storing only its sha256 hash (#152) and returning the plaintext to
 * present to the reset flow.
 */
export async function createPasswordResetToken(
  db: Kysely<DB>,
  opts: CreatePasswordResetTokenOpts,
): Promise<{ resetToken: string }> {
  const user = await db
    .selectFrom('users')
    .select('passwordHash')
    .where('id', '=', opts.input.id)
    .executeTakeFirst();

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (user.passwordHash === null) {
    throw opts.errors.NO_PASSWORD({ data: {} });
  }

  const resetToken = randomBytes(32).toString('hex');
  const passwordResetToken = createHash('sha256').update(resetToken).digest('hex');

  const passwordResetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .updateTable('users')
    .set({ passwordResetToken, passwordResetTokenExpiresAt })
    .where('id', '=', opts.input.id)
    .execute();

  return { resetToken };
}

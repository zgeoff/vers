import { createHash, timingSafeEqual } from 'node:crypto';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';

interface ResetPasswordOpts {
  readonly errors: {
    readonly INVALID_RESET_TOKEN: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly RESET_TOKEN_EXPIRED: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string; readonly password: string; readonly resetToken: string };
}

export async function resetPassword(
  db: Kysely<DB>,
  opts: ResetPasswordOpts,
): Promise<Record<never, never>> {
  const user = await db
    .selectFrom('users')
    .select(['passwordResetToken', 'passwordResetTokenExpiresAt'])
    .where('id', '=', opts.input.id)
    .executeTakeFirst();

  if (user === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (user.passwordResetToken === null) {
    throw opts.errors.INVALID_RESET_TOKEN({ data: {} });
  }

  if (user.passwordResetTokenExpiresAt !== null && user.passwordResetTokenExpiresAt < new Date()) {
    throw opts.errors.RESET_TOKEN_EXPIRED({ data: {} });
  }

  const providedTokenHash = createHash('sha256').update(opts.input.resetToken).digest();
  const storedTokenHash = Buffer.from(user.passwordResetToken, 'hex');

  const tokenMatches =
    providedTokenHash.length === storedTokenHash.length &&
    timingSafeEqual(providedTokenHash, storedTokenHash);

  if (!tokenMatches) {
    throw opts.errors.INVALID_RESET_TOKEN({ data: {} });
  }

  const passwordHash = await Bun.password.hash(opts.input.password, 'argon2id');

  // the users update only applies while the row still holds the token hash validated above, so
  // a concurrent reset that consumed the token first leaves this one matching zero rows; the
  // session purge is keyed off that same CTE, so it only fires when this call's reset won the race
  const result = await db
    .with('updated', (qb) =>
      qb
        .updateTable('users')
        .set({ passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null })
        .where('id', '=', opts.input.id)
        .where('passwordResetToken', '=', user.passwordResetToken)
        .returning('id'),
    )
    .with('purged', (qb) =>
      qb
        .deleteFrom('sessions')
        .where('userId', 'in', (eb) => eb.selectFrom('updated').select('id'))
        .returning('id'),
    )
    .selectFrom('updated')
    .select('id')
    .execute();

  if (result.length === 0) {
    throw opts.errors.INVALID_RESET_TOKEN({ data: {} });
  }

  return {};
}

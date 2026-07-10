import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

/**
 * oRPC handler opts for the authed `changePassword` procedure.
 */
interface ChangePasswordOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly password: string };
}

/**
 * Rehashes the acting user's password as argon2id; throws NOT_FOUND when the account is gone.
 */
export async function changePassword(
  db: Kysely<DB>,
  opts: ChangePasswordOpts,
): Promise<{ updatedID: string }> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const passwordHash = await Bun.password.hash(opts.input.password, 'argon2id');

  const row = await db
    .updateTable('users')
    .set({ passwordHash })
    .where('id', '=', opts.context.actingUserId)
    .returning('id as updatedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { updatedID: row.updatedId };
}

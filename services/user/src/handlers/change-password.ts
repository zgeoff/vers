import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface ChangePasswordOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly password: string };
}

export async function changePassword(
  db: Kysely<DB>,
  opts: ChangePasswordOpts,
): Promise<{ updatedID: string }> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const passwordHash = await Bun.password.hash(opts.input.password, 'argon2id');

  const row = await db
    .updateTable('users')
    .set({ passwordHash })
    .where('id', '=', opts.context.actingUserID)
    .returning('id as updatedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { updatedID: row.updatedId };
}

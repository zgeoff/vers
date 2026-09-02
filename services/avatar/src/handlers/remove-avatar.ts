import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface RemoveAvatarOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export async function removeAvatar(
  db: Kysely<DB>,
  opts: RemoveAvatarOpts,
): Promise<{ deletedID: string }> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .deleteFrom('avatars')
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserID)
    .returning('id as deletedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { deletedID: row.deletedId };
}

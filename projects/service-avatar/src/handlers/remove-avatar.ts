import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

/** oRPC handler opts for the authed `deleteAvatar` procedure. */
interface RemoveAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/** Removes an avatar owned by the acting user; throws NOT_FOUND when they don't own it. */
export async function removeAvatar(
  db: Kysely<DB>,
  opts: RemoveAvatarOpts,
): Promise<{ deletedID: string }> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .deleteFrom('avatars')
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserId)
    .returning('id as deletedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { deletedID: row.deletedId };
}

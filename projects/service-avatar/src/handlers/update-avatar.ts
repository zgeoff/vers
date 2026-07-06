import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

/** oRPC handler opts for the authed `updateAvatar` procedure. */
interface UpdateAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string; readonly name: string };
}

/** Renames an avatar owned by the acting user; throws NOT_FOUND when they don't own it. */
export async function updateAvatar(
  db: Kysely<DB>,
  opts: UpdateAvatarOpts,
): Promise<{ updatedID: string }> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .updateTable('avatars')
    .set({ name: opts.input.name })
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserId)
    .returning('id as updatedId')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { updatedID: row.updatedId };
}

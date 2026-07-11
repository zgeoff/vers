import type { AvatarData } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/**
 * oRPC handler opts for the authed `getAvatar` procedure.
 */
interface GetAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Returns an avatar owned by the acting user, or null when it doesn't exist or isn't theirs.
 */
export async function getAvatar(db: Kysely<DB>, opts: GetAvatarOpts): Promise<AvatarData | null> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserId)
    .executeTakeFirst();

  return row === undefined ? null : toAvatarData(row);
}

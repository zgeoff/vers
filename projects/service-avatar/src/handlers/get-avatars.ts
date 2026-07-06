import type { AvatarData } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/** oRPC handler opts for the authed `getAvatars` procedure. */
interface GetAvatarsOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

/** Lists every avatar owned by the acting user. */
export async function getAvatars(db: Kysely<DB>, opts: GetAvatarsOpts): Promise<Array<AvatarData>> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await db
    .selectFrom('avatars')
    .selectAll()
    .where('userId', '=', opts.context.actingUserId)
    .execute();

  return rows.map((row) => toAvatarData(row));
}

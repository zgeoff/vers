import type { AvatarRoster } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/**
 * oRPC handler opts for the authed `getAvatars` procedure.
 */
interface GetAvatarsOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

/**
 * Lists every avatar owned by the acting user together with the persisted active selection. One
 * joined statement, so the list and the selection come from the same snapshot and the answer can
 * never name an avatar it doesn't list.
 */
export async function getAvatars(db: Kysely<DB>, opts: GetAvatarsOpts): Promise<AvatarRoster> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await db
    .selectFrom('avatars')
    .leftJoin('activeAvatars', (join) =>
      join
        .onRef('activeAvatars.avatarId', '=', 'avatars.id')
        .onRef('activeAvatars.userId', '=', 'avatars.userId'),
    )
    .selectAll('avatars')
    .select('activeAvatars.avatarId as selectedAvatarId')
    .where('avatars.userId', '=', opts.context.actingUserID)
    .execute();

  return {
    activeAvatarID: rows.find((row) => row.selectedAvatarId !== null)?.id ?? null,
    avatars: rows.map((row) => toAvatarData(row)),
  };
}

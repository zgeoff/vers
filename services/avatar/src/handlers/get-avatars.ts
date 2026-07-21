import type { AvatarRoster } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/**
 * oRPC handler opts for the authed `getAvatars` procedure.
 */
interface GetAvatarsOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
}

/**
 * Lists every avatar owned by the acting user together with the persisted active selection.
 */
export async function getAvatars(db: Kysely<DB>, opts: GetAvatarsOpts): Promise<AvatarRoster> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await db
    .selectFrom('avatars')
    .selectAll()
    .where('userId', '=', opts.context.actingUserId)
    .execute();

  const active = await db
    .selectFrom('activeAvatars')
    .select(['avatarId'])
    .where('userId', '=', opts.context.actingUserId)
    .executeTakeFirst();

  return {
    activeAvatarID: active?.avatarId ?? null,
    avatars: rows.map((row) => toAvatarData(row)),
  };
}

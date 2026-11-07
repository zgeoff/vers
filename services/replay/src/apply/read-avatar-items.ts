import type { AvatarItems, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

export function readAvatarItems(
  db: Kysely<DB>,
  avatarID: string,
): Promise<Array<Selectable<AvatarItems>>> {
  return db
    .selectFrom('avatarItems')
    .selectAll()
    .where('avatarId', '=', avatarID)
    .orderBy('scopeId')
    .orderBy('chainIndex')
    .orderBy('ordinal')
    .execute();
}

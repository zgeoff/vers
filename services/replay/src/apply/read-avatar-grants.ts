import type { AvatarGrants, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

export function readAvatarGrants(
  db: Kysely<DB>,
  avatarID: string,
): Promise<Array<Selectable<AvatarGrants>>> {
  return db
    .selectFrom('avatarGrants')
    .selectAll()
    .where('avatarId', '=', avatarID)
    .orderBy('kind')
    .orderBy('key')
    .execute();
}

import type { ActiveAvatars, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';

export function createActiveAvatarRow(
  db: Kysely<DB>,
  data: Readonly<Insertable<ActiveAvatars>>,
): Promise<Selectable<ActiveAvatars>> {
  return db.insertInto('activeAvatars').values(data).returningAll().executeTakeFirstOrThrow();
}

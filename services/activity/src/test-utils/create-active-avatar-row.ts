import type { ActiveAvatars, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';

/**
 * Inserts an `active_avatars` row naming the given avatar as the given user's active one — this
 * service's fixtures need a real selection to test the start gate against, and don't own the
 * avatar domain.
 */
export function createActiveAvatarRow(
  db: Kysely<DB>,
  data: Readonly<Insertable<ActiveAvatars>>,
): Promise<Selectable<ActiveAvatars>> {
  return db.insertInto('activeAvatars').values(data).returningAll().executeTakeFirstOrThrow();
}

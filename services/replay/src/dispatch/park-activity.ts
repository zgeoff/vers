import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

/**
 * Parks an activity in a single statement, moving it out of the replay queue. Guarded to
 * `active` rows only, so a terminal or quarantined status is never overwritten; returns undefined
 * when the guard doesn't match.
 */
export function parkActivity(
  db: Kysely<DB>,
  activityID: string,
): Promise<Selectable<Activities> | undefined> {
  return db
    .updateTable('activities')
    .set({ status: 'parked' })
    .where('id', '=', activityID)
    .where('status', '=', 'active')
    .returningAll()
    .executeTakeFirst();
}

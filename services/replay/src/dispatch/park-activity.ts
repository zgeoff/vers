import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

/**
 * Parks an activity in a single statement, moving it out of the replay queue, and records the
 * status it held so unparking restores that status rather than assuming `active`. Guarded to the
 * statuses whose replay work an operator hold can still resolve — `active`, or a `stopped`/`capped`
 * row whose appended tail is still unadjudicated — so a rejected, quarantined, or already-parked
 * row is never overwritten; returns undefined when the guard doesn't match.
 */
export function parkActivity(
  db: Kysely<DB>,
  activityID: string,
): Promise<Selectable<Activities> | undefined> {
  return db
    .updateTable('activities')
    .set((eb) => ({ parkedFrom: eb.ref('status'), status: 'parked' as const }))
    .where('id', '=', activityID)
    .where('status', 'in', ['active', 'stopped', 'capped'])
    .returningAll()
    .executeTakeFirst();
}

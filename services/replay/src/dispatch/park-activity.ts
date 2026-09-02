import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

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

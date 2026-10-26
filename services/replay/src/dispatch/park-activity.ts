import type { Activities, DB } from '@vers/db';
import { transitionActivityStatus } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

export function parkActivity(
  db: Kysely<DB>,
  activityID: string,
): Promise<Selectable<Activities> | undefined> {
  return transitionActivityStatus(db, activityID, {
    from: ['active', 'stopped', 'capped'],
    to: 'parked',
  })
    .returningAll()
    .executeTakeFirst();
}

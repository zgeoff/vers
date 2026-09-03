import type { Activities, ActivityStatus, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

export function updateParkedActivities(
  db: Kysely<DB>,
): Promise<Array<Pick<Selectable<Activities>, 'id'>>> {
  return db
    .updateTable('activities')
    .set({
      parkedFrom: null,
      status: sql<ActivityStatus>`coalesce(parked_from, 'active'::activity_status)`,
    })
    .where('status', '=', 'parked')
    .where('simVersion', 'in', (eb) =>
      eb.selectFrom('simVersions').select('engineHash').where('status', '=', 'active'),
    )
    .returning('id')
    .execute();
}

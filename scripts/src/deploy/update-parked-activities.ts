import type { Activities, ActivityStatus, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

/**
 * Unparks every activity parked for an unstamped sim version whose hash the registry now carries
 * as `active`, in a single statement — the same sweep run's tombstone update already excludes the
 * current version and any row it just pruned, so this never reactivates onto an expired hash. Each
 * row returns to the status it parked from, so a stopped or capped run resumes as itself rather
 * than becoming appendable again; a row parked before that status was recorded could only have been
 * `active`.
 */
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

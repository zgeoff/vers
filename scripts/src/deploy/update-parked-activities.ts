import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

/**
 * Unparks every activity parked for an unstamped sim version whose hash the registry now carries
 * as `active`, in a single statement — the same sweep run's tombstone update already excludes the
 * current version and any row it just pruned, so this never reactivates onto an expired hash.
 */
export function updateParkedActivities(
  db: Kysely<DB>,
): Promise<Array<Pick<Selectable<Activities>, 'id'>>> {
  return db
    .updateTable('activities')
    .set({ status: 'active' })
    .where('status', '=', 'parked')
    .where('simVersion', 'in', (eb) =>
      eb.selectFrom('simVersions').select('engineHash').where('status', '=', 'active'),
    )
    .returning('id')
    .execute();
}

import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow } from './types';

/**
 * Deletes and returns every `sim_versions` row past its retention deadline, in a single statement
 * — except the current version (the newest `active` row by `deployedAt`), which stays regardless
 * of its `retainedUntil`. `is distinct from` against the current-version subquery keeps every row
 * eligible when no version is active, since `NULL`-valued equality would otherwise match nothing.
 */
export function removeExpiredSimVersions(db: Kysely<DB>): Promise<Array<SimVersionRow>> {
  return db
    .deleteFrom('simVersions')
    .where('retainedUntil', '<', sql<Date>`now()`)
    .where('engineHash', 'is distinct from', (eb) =>
      eb
        .selectFrom('simVersions')
        .select('engineHash')
        .where('status', '=', 'active')
        .orderBy('deployedAt', 'desc')
        .limit(1),
    )
    .returningAll()
    .execute();
}

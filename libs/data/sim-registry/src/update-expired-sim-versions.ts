import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow } from './types';

/**
 * Tombstones every `active` `sim_versions` row past its retention deadline in a single statement,
 * flipping `status` to `pruned` rather than deleting the row — dispatch tells a retained-but-expired
 * version (a pruned row: force a resync) apart from an unregistered one (no row: park the activity),
 * and deleting would collapse that distinction. Excludes the current version (the newest `active`
 * row by `deployedAt`) regardless of its own `retainedUntil`, so a lone active row is always
 * protected — the sweep never leaves the fleet with no valid replay target. The `active` guard also
 * keeps a repeat run from re-returning rows a prior sweep already pruned.
 */
export function updateExpiredSimVersions(db: Kysely<DB>): Promise<Array<SimVersionRow>> {
  return db
    .updateTable('simVersions')
    .set({ status: 'pruned' })
    .where('status', '=', 'active')
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

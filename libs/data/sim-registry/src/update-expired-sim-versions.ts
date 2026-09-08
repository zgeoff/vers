import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { buildCurrentEngineHashQuery } from './build-current-engine-hash-query';
import { buildPinnedEngineHashesQuery } from './build-pinned-engine-hashes-query';
import type { SimVersionRow } from './types';

export function updateExpiredSimVersions(db: Kysely<DB>): Promise<Array<SimVersionRow>> {
  return (
    db
      .updateTable('simVersions')

      // Flipping status to pruned rather than deleting the row lets dispatch tell a
      // retained-but-expired version (a pruned row: force a resync) apart from an unregistered one
      // (no row: park the activity).
      .set({ status: 'pruned' })
      .where('status', '=', 'active')
      .where('retainedUntil', '<', sql<Date>`now()`)

      // Excludes the current version regardless of its own retainedUntil, so a lone active row is
      // always protected. The active guard on both sides also keeps a repeat run from re-returning
      // rows a prior sweep already pruned.
      .where('engineHash', 'is distinct from', buildCurrentEngineHashQuery(db))
      .where('engineHash', 'not in', buildPinnedEngineHashesQuery(db))
      .returningAll()
      .execute()
  );
}

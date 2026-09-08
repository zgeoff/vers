import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { buildCurrentEngineHashQuery } from './build-current-engine-hash-query';
import { buildPinnedEngineHashesQuery } from './build-pinned-engine-hashes-query';
import type { RetentionRefusal } from './types';

export async function collectRetentionRefusals(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RetentionRefusal>> {
  const rows = await db
    .selectFrom('simVersions')
    .select((eb) => [
      'engineHash',
      eb
        .selectFrom(buildPinnedEngineHashesQuery(db).as('pinned'))
        .select((inner) => inner.fn.countAll<string>().as('count'))
        .whereRef('pinned.simVersion', '=', 'simVersions.engineHash')
        .as('unverifiedActivities'),
    ])
    .where('status', '=', 'active')
    .where('retainedUntil', '<', sql<Date>`now()`)
    .where('engineHash', 'is distinct from', buildCurrentEngineHashQuery(db))
    .where('engineHash', 'in', buildPinnedEngineHashesQuery(db))
    .orderBy('engineHash')
    .execute();

  return rows.map((row) => ({
    engineHash: row.engineHash,
    unverifiedActivities: Number(row.unverifiedActivities),
  }));
}

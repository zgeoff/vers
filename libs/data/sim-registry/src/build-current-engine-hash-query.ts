import type { DB } from '@vers/db';
import type { Kysely, SelectQueryBuilder } from 'kysely';

// the current version is the newest active row by deploy time, and the same tie-breaker as the
// current-version read keeps two rows deployed in one instant from naming different versions
export function buildCurrentEngineHashQuery(
  db: Kysely<DB>,
): SelectQueryBuilder<DB, 'simVersions', { engineHash: string }> {
  return db
    .selectFrom('simVersions')
    .select('engineHash')
    .where('status', '=', 'active')
    .orderBy('deployedAt', 'desc')
    .orderBy('engineHash', 'desc')
    .limit(1);
}

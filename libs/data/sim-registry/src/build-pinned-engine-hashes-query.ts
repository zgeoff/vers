import type { DB } from '@vers/db';
import type { Kysely, SelectQueryBuilder } from 'kysely';

// a version is pinned while any activity stamped with it still carries appends the verifier has
// not proved, unless that activity is already rejected
export function buildPinnedEngineHashesQuery(
  db: Kysely<DB>,
): SelectQueryBuilder<DB, 'activities', { simVersion: string }> {
  return db
    .selectFrom('activities')
    .select('simVersion')
    .where((eb) => eb('appendedHead', '>', eb.ref('verifiedHead')))
    .where('status', '!=', 'rejected');
}

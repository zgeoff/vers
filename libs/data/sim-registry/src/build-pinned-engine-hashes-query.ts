import type { DB } from '@vers/db';
import type { Kysely, SelectQueryBuilder } from 'kysely';

export function buildPinnedEngineHashesQuery(
  db: Kysely<DB>,
): SelectQueryBuilder<DB, 'activities', { simVersion: string }> {
  return db
    .selectFrom('activities')
    .select('simVersion')
    .where((eb) => eb('appendedHead', '>', eb.ref('verifiedHead')))
    .where('status', '!=', 'rejected');
}

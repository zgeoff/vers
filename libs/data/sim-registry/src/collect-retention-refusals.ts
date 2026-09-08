import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { RetentionRefusal } from './types';

export async function collectRetentionRefusals(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RetentionRefusal>> {
  const rows = await db
    .selectFrom('simVersions')
    .innerJoin('activities', 'activities.simVersion', 'simVersions.engineHash')
    .select((eb) => [
      'simVersions.engineHash',
      eb.fn.count<string>('activities.id').as('unverifiedActivities'),
    ])
    .where('simVersions.status', '=', 'active')
    .where('simVersions.retainedUntil', '<', sql<Date>`now()`)
    .where('simVersions.engineHash', 'is distinct from', (eb) =>
      eb
        .selectFrom('simVersions as current')
        .select('current.engineHash')
        .where('current.status', '=', 'active')
        .orderBy('current.deployedAt', 'desc')
        .limit(1),
    )
    .where((eb) => eb('activities.appendedHead', '>', eb.ref('activities.verifiedHead')))
    .where('activities.status', '!=', 'rejected')
    .groupBy('simVersions.engineHash')
    .orderBy('simVersions.engineHash')
    .execute();

  return rows.map((row) => ({
    engineHash: row.engineHash,
    unverifiedActivities: Number(row.unverifiedActivities),
  }));
}

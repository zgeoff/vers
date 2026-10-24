import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RestoreDrillCheck } from './types';

export async function readSimVersionChecks(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RestoreDrillCheck>> {
  const [unverifiedWorkWithoutEngine, activitiesWithoutContent] = await Promise.all([
    db
      .selectFrom('activities')
      .leftJoin('simVersions as engine', 'engine.engineHash', 'activities.simVersion')
      .select(['activities.id', 'activities.simVersion'])
      .whereRef('activities.appendedHead', '>', 'activities.verifiedHead')

      // a parked activity already waits on an operator for its engine
      .where('activities.status', 'not in', ['parked', 'rejected'])
      .where((eb) =>
        eb.or([
          eb('engine.engineHash', 'is', null),
          eb('engine.status', '!=', 'active'),
          eb('engine.retainedUntil', '<=', new Date()),
        ]),
      )
      .orderBy('activities.id')
      .execute(),
    db
      .selectFrom('activities')
      .leftJoin('contentVersions as content', 'content.contentVersion', 'activities.contentVersion')
      .select(['activities.id', 'activities.contentVersion'])
      .where('content.contentVersion', 'is', null)
      .orderBy('activities.id')
      .execute(),
  ]);

  return [
    {
      area: 'retained-sim-versions',
      name: 'unverified work pins a retained sim version',
      violations: unverifiedWorkWithoutEngine.map(
        (row) => `activity ${row.id} on sim version ${row.simVersion}`,
      ),
    },
    {
      area: 'retained-sim-versions',
      name: 'every activity’s content version is published',
      violations: activitiesWithoutContent.map(
        (row) => `activity ${row.id} on content version ${row.contentVersion}`,
      ),
    },
  ];
}

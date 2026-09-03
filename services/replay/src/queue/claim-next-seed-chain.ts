import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedActivity } from '../types';

export async function claimNextSeedChain(
  trx: Transaction<DB>,
): Promise<ClaimedActivity | undefined> {
  const row = await trx
    .selectFrom('avatars')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('activities')

          // Scoped to the same avatar: a predecessor naming another avatar's activity finds no row
          // here, so it reads as absent and the claim waits rather than coupling this avatar's
          // order to a foreign one.
          .leftJoin('activities as predecessor', (join) =>
            join
              .onRef('predecessor.id', '=', 'activities.predecessorActivityId')
              .onRef('predecessor.avatarId', '=', 'activities.avatarId'),
          )
          .select([
            'activities.id',
            'activities.scopeId',
            'activities.scopeType',
            'activities.status',
          ])
          .whereRef('activities.avatarId', '=', 'avatars.id')
          .where((eb2) => eb2('activities.appendedHead', '>', eb2.ref('activities.verifiedHead')))
          .where('activities.status', '!=', 'rejected')
          .where((eb2) => {
            // settled: verified to its head and not held — a parked or quarantined predecessor,
            // even one with no appends past its cursor, still blocks everything after it
            const settledAndUnheld = eb2.and([
              eb2('predecessor.verifiedHead', '>=', eb2.ref('predecessor.appendedHead')),
              eb2('predecessor.status', 'not in', ['parked', 'quarantined']),
            ]);

            return eb2.or([
              eb2('activities.predecessorActivityId', 'is', null),
              eb2('predecessor.status', '=', 'rejected'),
              settledAndUnheld,
            ]);
          })
          .orderBy('activities.startChainIndex')
          .limit(1)
          .as('next_activity'),
      (join) => join.onTrue(),
    )
    .innerJoin('activityChains as chain', (join) =>
      join
        .onRef('chain.avatarId', '=', 'avatars.id')
        .onRef('chain.scopeType', '=', 'next_activity.scopeType')
        .onRef('chain.scopeId', '=', 'next_activity.scopeId'),
    )
    .select([
      'avatars.id as avatarId',
      'chain.priority',
      'next_activity.id as activityId',
      'next_activity.scopeId',
      'next_activity.scopeType',
    ])
    .where('next_activity.status', 'not in', ['quarantined', 'parked'])
    .orderBy('chain.priority', 'desc')
    .orderBy('chain.createdAt')
    .limit(1)
    .forUpdate('chain')
    .skipLocked()
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  return {
    activityID: row.activityId,
    avatarID: row.avatarId,
    priority: row.priority,
    scopeID: row.scopeId,
    scopeType: row.scopeType,
  };
}

import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedActivity } from '../types';

/**
 * Claims an avatar's next-in-order activity for replay: the oldest activity, across every chain,
 * with appends past its verified cursor. A predecessor that is settled or rejected qualifies its
 * successor; a null predecessor (the avatar's first-ever activity) always qualifies. A quarantined
 * or parked activity is excluded, and blocks every activity after it, exactly as a held
 * predecessor does. At most one activity per avatar is ever claimable at a time.
 *
 * Must run inside the caller's transaction: the claim is a row lock (`FOR UPDATE SKIP LOCKED`) that
 * releases on commit or rollback. The lock only prevents duplicated effort — exactly-once
 * application is the verified-cursor guard's job, not this lock's.
 */
export async function claimNextChain(trx: Transaction<DB>): Promise<ClaimedActivity | undefined> {
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
          .where((eb2) =>
            eb2.or([
              eb2('activities.predecessorActivityId', 'is', null),
              eb2('predecessor.status', '=', 'rejected'),
              eb2('predecessor.verifiedHead', '>=', eb2.ref('predecessor.appendedHead')),
            ]),
          )
          .orderBy('activities.startChainIndex')
          .limit(1)
          .as('frontier'),
      (join) => join.onTrue(),
    )
    .innerJoin('activityChains as chain', (join) =>
      join
        .onRef('chain.avatarId', '=', 'avatars.id')
        .onRef('chain.scopeType', '=', 'frontier.scopeType')
        .onRef('chain.scopeId', '=', 'frontier.scopeId'),
    )
    .select([
      'avatars.id as avatarId',
      'chain.priority',
      'frontier.id as activityId',
      'frontier.scopeId',
      'frontier.scopeType',
    ])
    .where('frontier.status', 'not in', ['quarantined', 'parked'])
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

import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedActivity } from '../types';

/**
 * Claims an avatar's next-in-order activity for replay: the oldest of its activities, across every
 * chain, with appends past its verified cursor and a predecessor that is either settled (no appends
 * left past its own verified cursor) or rejected (final adjudication, so its own successors must be
 * claimed to be refused rather than waiting on it forever) — the avatar's whole activity history is
 * one predecessor-linked order, so at most one activity can ever satisfy this at a time. A null
 * predecessor (the avatar's first-ever activity) is always claimable. Locked with
 * `FOR UPDATE SKIP LOCKED` on the claimed activity's own chain row, so concurrent workers each claim
 * a different avatar's work without waiting — the single linked order per avatar means two workers
 * can never find two different chains simultaneously ready for the same avatar.
 *
 * A claimed activity whose own status is quarantined or parked is excluded: it already sits held for
 * an operator, so replaying it again is not work — the whole avatar stays blocked until the hold
 * clears, exactly as a held predecessor blocks everything after it. Must run inside the caller's
 * transaction — the claim is the row lock, and it releases on commit or rollback. The lock only
 * prevents duplicated effort: exactly-once application is the verified-cursor guard's job, not this
 * lock's.
 */
export async function claimNextChain(trx: Transaction<DB>): Promise<ClaimedActivity | undefined> {
  const row = await trx
    .selectFrom('avatars')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('activities')
          .leftJoin(
            'activities as predecessor',
            'predecessor.id',
            'activities.predecessorActivityId',
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

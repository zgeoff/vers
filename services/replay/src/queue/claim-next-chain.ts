import type { DB } from '@vers/db';
import type { Transaction } from 'kysely';
import type { ClaimedChain } from '../types';

/**
 * Claims the next chain with replay work: highest priority first, locked with
 * `FOR UPDATE SKIP LOCKED` so concurrent workers each claim a different chain without waiting. A
 * chain has work when any of its activities has appends past its verified cursor; a chain whose
 * replay frontier is quarantined or parked is unclaimable, since per-chain FIFO forbids replaying
 * anything behind it. A rejected frontier is final adjudication rather than an operator hold, so
 * it stops counting as work too — its rewind already voided every successor rooted past the
 * verified anchor, leaving nothing left behind it to unblock. Must run inside the caller's
 * transaction — the claim is the row lock, and it releases on commit or rollback. The lock only
 * prevents duplicated effort: exactly-once application is the verified-cursor guard's job, not
 * this lock's.
 *
 * A frontier whose build snapshot borrowed unsettled xp is unclaimable until every run it borrowed
 * from has no appends left past its own verified cursor. Chains are scoped per (avatar, scope)
 * while identity is avatar-global, so that wait is what orders an avatar's chains against each
 * other: adjudicating a borrower before its source would settle xp and mint items against a total
 * the source's own rejection could still erase. A source held under an operator park keeps its
 * borrowers waiting, since a hold that later rejects would leave the same unbacked total in place.
 * A rejected source is deliberately not a barrier, whatever its cursors read: its borrowers must be
 * claimed to be refused, and blocking them would strand them unadjudicated forever.
 */
export async function claimNextChain(trx: Transaction<DB>): Promise<ClaimedChain | undefined> {
  const row = await trx
    .selectFrom('activityChains as chain')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('activities')
          .select(['activities.id', 'activities.status'])
          .whereRef('activities.avatarId', '=', 'chain.avatarId')
          .whereRef('activities.scopeType', '=', 'chain.scopeType')
          .whereRef('activities.scopeId', '=', 'chain.scopeId')
          .whereRef('activities.appendedHead', '>', 'activities.verifiedHead')
          .where('activities.status', '!=', 'rejected')
          .orderBy('activities.startChainIndex')
          .limit(1)
          .as('frontier'),
      (join) => join.onTrue(),
    )
    .select(['chain.avatarId', 'chain.priority', 'chain.scopeId', 'chain.scopeType'])
    .where('frontier.status', 'not in', ['quarantined', 'parked'])
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('activitySnapshotSources as edge')
            .innerJoin('activities as source', 'source.id', 'edge.sourceActivityId')
            .select('edge.sourceActivityId')
            .whereRef('edge.activityId', '=', 'frontier.id')
            .where('source.status', '!=', 'rejected')
            .whereRef('source.verifiedHead', '<', 'source.appendedHead'),
        ),
      ),
    )
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
    avatarID: row.avatarId,
    priority: row.priority,
    scopeID: row.scopeId,
    scopeType: row.scopeType,
  };
}

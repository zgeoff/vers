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
 */
export async function claimNextChain(trx: Transaction<DB>): Promise<ClaimedChain | undefined> {
  const row = await trx
    .selectFrom('activityChains as chain')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('activities')
          .select('activities.status')
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

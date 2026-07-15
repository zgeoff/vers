import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ChainKey, ReplayFrontier } from '../types';

/**
 * The chain's oldest activity with appends past its verified cursor, in `start_chain_index` order
 * — the next unit of replay work. Undefined when the chain is fully replayed. Per-chain FIFO means
 * the frontier is the only activity a worker may replay; its status is the caller's to inspect (a
 * quarantined or parked frontier blocks the chain). A rejected activity is excluded from
 * candidacy entirely — it is final adjudication, not a hold, so it never counts as work and never
 * blocks an honest activity behind it.
 */
export async function findReplayFrontier(
  db: Kysely<DB>,
  chain: Readonly<ChainKey>,
): Promise<ReplayFrontier | undefined> {
  const row = await db
    .selectFrom('activities')
    .select(['appendedHead', 'id', 'replayAttempts', 'startChainIndex', 'status', 'verifiedHead'])
    .where('avatarId', '=', chain.avatarID)
    .where('scopeType', '=', chain.scopeType)
    .where('scopeId', '=', chain.scopeID)
    .where((eb) => eb('appendedHead', '>', eb.ref('verifiedHead')))
    .where('status', '!=', 'rejected')
    .orderBy('startChainIndex')
    .limit(1)
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  return {
    activityID: row.id,
    appendedHead: row.appendedHead,
    replayAttempts: row.replayAttempts,
    startChainIndex: row.startChainIndex,
    status: row.status,
    verifiedHead: row.verifiedHead,
  };
}

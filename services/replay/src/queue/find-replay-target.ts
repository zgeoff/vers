import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ReplayTarget } from '../types';

/**
 * Loads the claimed activity's own replay-relevant fields — the claim itself already identified it
 * as the avatar's next-in-order activity, so this is a plain lookup rather than a search. Undefined
 * when the row is gone (raced against a concurrent cleanup); the caller treats that as nothing to
 * replay.
 */
export async function findReplayTarget(
  db: Kysely<DB>,
  activityID: string,
): Promise<ReplayTarget | undefined> {
  const row = await db
    .selectFrom('activities')
    .select(['appendedHead', 'id', 'replayAttempts', 'startChainIndex', 'status', 'verifiedHead'])
    .where('id', '=', activityID)
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

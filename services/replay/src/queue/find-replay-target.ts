import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ReplayTarget } from '../types';

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

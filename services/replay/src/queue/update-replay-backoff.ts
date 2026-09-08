import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

const REPLAY_BACKOFF_BASE_MS = 30_000;
const REPLAY_BACKOFF_CAP_MS = 900_000;

interface UpdateReplayBackoffInput {
  readonly activityID: string;

  readonly verifiedHead: number;
}

interface UpdateReplayBackoffResult {
  readonly backoffUntil: Date;
  readonly backoffs: number;
}

export async function updateReplayBackoff(
  db: Kysely<DB>,
  input: Readonly<UpdateReplayBackoffInput>,
): Promise<UpdateReplayBackoffResult | undefined> {
  const row = await db
    .updateTable('activities')
    .set((eb) => ({
      replayBackoffUntil: sql<Date>`now() + LEAST(${REPLAY_BACKOFF_BASE_MS} * POWER(2, replay_backoffs), ${REPLAY_BACKOFF_CAP_MS}) * interval '1 millisecond'`,
      replayBackoffs: eb('replayBackoffs', '+', 1),
    }))
    .where('id', '=', input.activityID)

    // a worker that settled the activity between this worker's rollback and this write leaves
    // nothing to back off, so the stale failure must not delay the next append
    .where('verifiedHead', '=', input.verifiedHead)
    .where((eb) => eb('appendedHead', '>', eb.ref('verifiedHead')))
    .returning(['replayBackoffUntil', 'replayBackoffs'])
    .executeTakeFirst();

  if (row?.replayBackoffUntil === undefined || row.replayBackoffUntil === null) {
    return undefined;
  }

  return { backoffUntil: row.replayBackoffUntil, backoffs: row.replayBackoffs };
}

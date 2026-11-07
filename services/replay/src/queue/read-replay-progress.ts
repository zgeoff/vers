import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface ReplayProgress {
  readonly appendedHead: number;
  readonly replayAttempts: number;
  readonly replayBackoffs: number;
  readonly replayBackoffUntil: Date | null;
  readonly settledXP: number;
  readonly verifiedAt: Date | null;
  readonly verifiedHead: number;
}

export async function readReplayProgress(
  db: Kysely<DB>,
  activityID: string,
): Promise<ReplayProgress | null> {
  const row = await db
    .selectFrom('activities')
    .select([
      'appendedHead',
      'replayAttempts',
      'replayBackoffs',
      'replayBackoffUntil',
      'settledXp',
      'verifiedAt',
      'verifiedHead',
    ])
    .where('id', '=', activityID)
    .executeTakeFirst();

  if (row === undefined) {
    return null;
  }

  return {
    appendedHead: row.appendedHead,
    replayAttempts: row.replayAttempts,
    replayBackoffs: row.replayBackoffs,
    replayBackoffUntil: row.replayBackoffUntil,
    settledXP: row.settledXp,
    verifiedAt: row.verifiedAt,
    verifiedHead: row.verifiedHead,
  };
}

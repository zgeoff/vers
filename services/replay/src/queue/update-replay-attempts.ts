import type { ActivityStatus, DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';

export const MAX_REPLAY_ATTEMPTS = 5;

interface UpdateReplayAttemptsInput {
  readonly activityID: string;
  readonly maxAttempts?: number;

  readonly status?: ActivityStatus;
  readonly verifiedHead?: number;
}

interface UpdateReplayAttemptsResult {
  readonly attempts: number;
  readonly quarantined: boolean;
}

export async function updateReplayAttempts(
  db: Kysely<DB>,
  input: Readonly<UpdateReplayAttemptsInput>,
): Promise<UpdateReplayAttemptsResult | undefined> {
  const maxAttempts = input.maxAttempts ?? MAX_REPLAY_ATTEMPTS;
  const hasGuard = input.verifiedHead !== undefined && input.status !== undefined;

  const row = await db
    .updateTable('activities')
    .set((eb) => ({
      replayAttempts: eb('replayAttempts', '+', 1),
      status: sql<ActivityStatus>`CASE WHEN replay_attempts + 1 >= ${maxAttempts} THEN 'quarantined' ELSE status END`,
    }))
    .where('id', '=', input.activityID)
    .$if(hasGuard, (qb) =>
      qb
        .where('verifiedHead', '=', input.verifiedHead ?? 0)
        .where('status', '=', input.status ?? 'active'),
    )
    .returning(['replayAttempts', 'status'])
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  return { attempts: row.replayAttempts, quarantined: row.status === 'quarantined' };
}

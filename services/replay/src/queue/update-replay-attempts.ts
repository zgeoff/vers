import type { ActivityStatus, DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * How many failed replays an activity survives before it quarantines.
 */
export const MAX_REPLAY_ATTEMPTS = 5;

interface UpdateReplayAttemptsInput {
  readonly activityID: string;
  readonly maxAttempts?: number;
}

interface UpdateReplayAttemptsResult {
  readonly attempts: number;
  readonly quarantined: boolean;
}

/**
 * Counts one failed replay against the activity in a single statement: the attempt counter
 * increments, and crossing `maxAttempts` transitions the status to `quarantined` in the same
 * update — the poison-pill exit that takes the chain out of the claim queue. The caller owns
 * alerting on a `quarantined: true` result; a successful apply resets the counter.
 */
export async function updateReplayAttempts(
  db: Kysely<DB>,
  input: Readonly<UpdateReplayAttemptsInput>,
): Promise<UpdateReplayAttemptsResult | undefined> {
  const maxAttempts = input.maxAttempts ?? MAX_REPLAY_ATTEMPTS;

  const row = await db
    .updateTable('activities')
    .set((eb) => ({
      replayAttempts: eb('replayAttempts', '+', 1),
      status: sql<ActivityStatus>`CASE WHEN replay_attempts + 1 >= ${maxAttempts} THEN 'quarantined'::activity_status ELSE status END`,
    }))
    .where('id', '=', input.activityID)
    .returning(['replayAttempts', 'status'])
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  return { attempts: row.replayAttempts, quarantined: row.status === 'quarantined' };
}

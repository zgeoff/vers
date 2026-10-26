import type { DB } from '@vers/db';
import { transitionActivityStatus } from '@vers/db';
import type { Kysely } from 'kysely';

export const MAX_REPLAY_ATTEMPTS = 5;

interface UpdateReplayAttemptsInput {
  readonly activityID: string;
  readonly maxAttempts?: number;
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

  const row = await db
    .updateTable('activities')
    .set((eb) => ({ replayAttempts: eb('replayAttempts', '+', 1) }))
    .where('id', '=', input.activityID)
    .returning('replayAttempts')
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  if (row.replayAttempts < maxAttempts) {
    return { attempts: row.replayAttempts, quarantined: false };
  }

  const quarantined = await transitionActivityStatus(db, input.activityID, {
    from: ['active', 'stopped', 'capped'],
    to: 'quarantined',
  })
    .returning('id')
    .executeTakeFirst();

  return { attempts: row.replayAttempts, quarantined: quarantined !== undefined };
}

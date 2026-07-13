import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Deletes an activity's queued checkpoints at or below the server's confirmed head — the success
 * and `CONFLICT` submission branches both trim the queue to a fresh `appendedHead` this way.
 */
export async function removeConfirmedCheckpoints(
  activityID: string,
  appendedHead: number,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const range = IDBKeyRange.bound([activityID, 0], [activityID, appendedHead]);

  await db.delete(CHECKPOINT_QUEUE_STORE_NAME, range);
}

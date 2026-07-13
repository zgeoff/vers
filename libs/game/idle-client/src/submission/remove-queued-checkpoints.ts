import { buildActivityKeyRange } from './build-activity-key-range';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Deletes every queued checkpoint for an activity — the `NOT_FOUND` submission branch discards a
 * stream's whole queue once the activity itself is gone.
 */
export async function removeQueuedCheckpoints(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(CHECKPOINT_QUEUE_STORE_NAME, buildActivityKeyRange(activityID));
}

import { buildActivityKeyRange } from './build-activity-key-range';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removeQueuedCheckpoints(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(CHECKPOINT_QUEUE_STORE_NAME, buildActivityKeyRange(activityID));
}

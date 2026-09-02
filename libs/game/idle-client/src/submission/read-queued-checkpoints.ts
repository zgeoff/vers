import { buildActivityKeyRange } from './build-activity-key-range';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { QueuedCheckpoint } from './types';

export async function readQueuedCheckpoints(activityID: string): Promise<Array<QueuedCheckpoint>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(CHECKPOINT_QUEUE_STORE_NAME, buildActivityKeyRange(activityID));
}

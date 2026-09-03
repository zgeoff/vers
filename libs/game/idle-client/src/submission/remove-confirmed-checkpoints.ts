import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removeConfirmedCheckpoints(
  activityID: string,
  appendedHead: number,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(
    CHECKPOINT_QUEUE_STORE_NAME,
    IDBKeyRange.bound([activityID, 0], [activityID, appendedHead]),
  );
}

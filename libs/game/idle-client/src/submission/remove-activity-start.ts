import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removeActivityStart(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(PENDING_ACTIVITY_STARTS_STORE_NAME, activityID);
}

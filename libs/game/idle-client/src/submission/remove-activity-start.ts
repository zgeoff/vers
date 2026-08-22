import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Removes one activity's client-minted activity start row, once the server has accepted it or
 * refused it outright — the durable record a crash between mint and install would otherwise recover
 * is no longer needed either way.
 */
export async function removeActivityStart(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(PENDING_ACTIVITY_STARTS_STORE_NAME, activityID);
}

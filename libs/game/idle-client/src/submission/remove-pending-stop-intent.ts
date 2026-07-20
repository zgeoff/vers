import { PENDING_STOP_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Removes the held stop intent, but only while it still names the delivered activity — a fresher
 * intent written while this delivery was in flight is someone else's undelivered work and stays.
 * The read and delete share one transaction, so the check and the removal are atomic.
 */
export async function removePendingStopIntent(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  const record = await transaction.store.get(PENDING_STOP_INTENT_KEY);

  if (record !== undefined && 'activityID' in record && record.activityID === activityID) {
    await transaction.store.delete(PENDING_STOP_INTENT_KEY);
  }

  await transaction.done;
}

import { PENDING_START_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Removes the held continuation-start intent. With `expectedActivityID`, the removal applies only
 * while the record still names that source row — a fresher intent written while the caller's
 * delivery was in flight is someone else's outstanding work and stays; the read and delete share
 * one transaction, so the check and the removal are atomic. Without it, the removal is
 * unconditional — a stop or a fresher selection kills any outstanding intent.
 */
export async function removePendingStartIntent(expectedActivityID?: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  if (expectedActivityID === undefined) {
    await db.delete(PREFERENCES_STORE_NAME, PENDING_START_INTENT_KEY);

    return;
  }

  const transaction = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  const record = await transaction.store.get(PENDING_START_INTENT_KEY);

  if (record !== undefined && 'scopeID' in record && record.activityID === expectedActivityID) {
    await transaction.store.delete(PENDING_START_INTENT_KEY);
  }

  await transaction.done;
}

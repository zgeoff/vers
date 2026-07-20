import { PENDING_START_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Removes the held start intent, but only while it still carries the delivered key — a fresher
 * intent written while this delivery was in flight stays held. The read and delete share one
 * transaction, so the check and the removal are atomic.
 */
export async function removePendingStartIntent(startKey: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  const record = await transaction.store.get(PENDING_START_INTENT_KEY);

  if (record !== undefined && 'startKey' in record && record.startKey === startKey) {
    await transaction.store.delete(PENDING_START_INTENT_KEY);
  }

  await transaction.done;
}

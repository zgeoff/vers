import { PENDING_STOP_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removePendingStopIntent(activityID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  const record = await transaction.store.get(PENDING_STOP_INTENT_KEY);

  if (record !== undefined && 'activityID' in record && record.activityID === activityID) {
    await transaction.store.delete(PENDING_STOP_INTENT_KEY);
  }

  await transaction.done;
}

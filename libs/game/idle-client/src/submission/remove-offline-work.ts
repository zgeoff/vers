import {
  CHECKPOINT_QUEUE_STORE_NAME,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function removeOfflineWork(): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(
    [CHECKPOINT_QUEUE_STORE_NAME, PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readwrite',
  );

  await Promise.all([
    transaction.objectStore(CHECKPOINT_QUEUE_STORE_NAME).clear(),
    transaction.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME).clear(),
    transaction.objectStore(PREFERENCES_STORE_NAME).clear(),
    transaction.done,
  ]);
}

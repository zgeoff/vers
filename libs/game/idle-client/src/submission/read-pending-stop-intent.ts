import { PENDING_STOP_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { PendingStopIntent } from './types';

/**
 * Reads the undelivered stop intent, `undefined` when every raised stop has been delivered.
 */
export async function readPendingStopIntent(): Promise<PendingStopIntent | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, PENDING_STOP_INTENT_KEY);

  return record !== undefined && 'activityID' in record && !('scopeID' in record)
    ? record
    : undefined;
}

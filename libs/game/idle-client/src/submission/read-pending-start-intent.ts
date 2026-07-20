import { PENDING_START_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { PendingStartIntent } from './types';

/**
 * Reads the undelivered start intent, `undefined` when every raised start has been delivered.
 */
export async function readPendingStartIntent(): Promise<PendingStartIntent | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, PENDING_START_INTENT_KEY);

  return record !== undefined && 'startKey' in record ? record : undefined;
}

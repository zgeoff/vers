import { PENDING_START_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { PendingStartIntent } from './types';

/**
 * Reads the held continuation-start intent, narrowing past the other record shapes sharing the
 * preferences store; `undefined` when none is held.
 */
export async function readPendingStartIntent(): Promise<PendingStartIntent | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, PENDING_START_INTENT_KEY);

  return record !== undefined && 'scopeID' in record ? record : undefined;
}

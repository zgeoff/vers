import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

/**
 * Reads the cached `revealNodes` crypto stamps; `undefined` when this device has never revealed a
 * node for any avatar.
 */
export async function readStartStamps(): Promise<StartStampsPreference | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, START_STAMPS_KEY);

  // Narrows past the other record shapes sharing the preferences store.
  return record !== undefined && 'keyVersion' in record ? record : undefined;
}

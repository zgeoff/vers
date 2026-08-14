import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

/**
 * Reads the cached `revealNodes` crypto stamps, narrowing past the other record shapes sharing the
 * preferences store; `undefined` when this device has never revealed a node for any avatar.
 */
export async function readStartStamps(): Promise<StartStampsPreference | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, START_STAMPS_KEY);

  return record !== undefined && 'keyVersion' in record ? record : undefined;
}

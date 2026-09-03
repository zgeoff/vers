import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

export async function readStartStamps(): Promise<StartStampsPreference | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, START_STAMPS_KEY);

  // Narrows past the other record shapes sharing the preferences store.
  return record !== undefined && 'keyVersion' in record ? record : undefined;
}

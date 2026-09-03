import { FAILURE_ACTION_PREFERENCE_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { FailureActionPreference } from './types';

export async function writeFailureActionCache(
  preference: Readonly<FailureActionPreference>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PREFERENCES_STORE_NAME, preference, FAILURE_ACTION_PREFERENCE_KEY);
}

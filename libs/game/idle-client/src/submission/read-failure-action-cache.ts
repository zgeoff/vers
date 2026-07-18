import { FAILURE_ACTION_PREFERENCE_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { FailureActionPreference } from './types';

/**
 * Reads the cached failure-action preference, `undefined` when nothing has ever been written —
 * a fresh install with no local override yet.
 */
export async function readFailureActionCache(): Promise<FailureActionPreference | undefined> {
  const db = await resolveCheckpointQueueDB();

  return db.get(PREFERENCES_STORE_NAME, FAILURE_ACTION_PREFERENCE_KEY);
}

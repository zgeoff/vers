import { FAILURE_ACTION_PREFERENCE_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { FailureActionPreference } from './types';

export async function readFailureActionCache(): Promise<FailureActionPreference | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, FAILURE_ACTION_PREFERENCE_KEY);

  return record !== undefined && 'failureAction' in record ? record : undefined;
}

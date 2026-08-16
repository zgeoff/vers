import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { LastStartedActivityPreference } from './types';

/**
 * Reads the avatar's last-started activity id, narrowing past the other record shapes sharing the
 * preferences store; `undefined` when this device has never started an activity for any avatar.
 */
export async function readLastStartedActivity(): Promise<
  LastStartedActivityPreference | undefined
> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, LAST_STARTED_ACTIVITY_KEY);

  return record !== undefined && 'lastActivityID' in record ? record : undefined;
}

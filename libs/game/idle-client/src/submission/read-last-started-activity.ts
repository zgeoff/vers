import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { LastStartedActivityPreference } from './types';

/**
 * Reads an avatar's last-started activity, narrowing past the other record shapes sharing the
 * preferences store; `undefined` when this device has never started an activity for that avatar.
 */
export async function readLastStartedActivity(
  avatarID: string,
): Promise<LastStartedActivityPreference | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(PREFERENCES_STORE_NAME, `${LAST_STARTED_ACTIVITY_KEY}:${avatarID}`);

  return record !== undefined && 'lastActivityID' in record ? record : undefined;
}

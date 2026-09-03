import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { LastStartedActivityPreference } from './types';

export async function writeLastStartedActivity(
  preference: Readonly<LastStartedActivityPreference>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(
    PREFERENCES_STORE_NAME,
    preference,
    `${LAST_STARTED_ACTIVITY_KEY}:${preference.avatarID}`,
  );
}

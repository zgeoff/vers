import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { LastStartedActivityPreference } from './types';

/**
 * Persists the avatar's newly minted activity as its last-started one, overwriting whatever the
 * record held before — a worker drives one avatar's simulation at a time, so the newest start
 * always wins.
 */
export async function writeLastStartedActivity(
  preference: Readonly<LastStartedActivityPreference>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PREFERENCES_STORE_NAME, preference, LAST_STARTED_ACTIVITY_KEY);
}

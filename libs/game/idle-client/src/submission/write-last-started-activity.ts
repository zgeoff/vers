import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { LastStartedActivityPreference } from './types';

/**
 * Persists the avatar's newly minted activity as its last-started one. The record is keyed per
 * avatar, so switching avatars and back leaves each avatar's own last-started intact — the
 * predecessor a later start for it stamps.
 */
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

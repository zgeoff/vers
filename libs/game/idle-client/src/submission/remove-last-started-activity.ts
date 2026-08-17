import { LAST_STARTED_ACTIVITY_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Clears an avatar's last-started record, so a later start for it stamps no predecessor rather than
 * one that was dropped as unverifiable.
 */
export async function removeLastStartedActivity(avatarID: string): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.delete(PREFERENCES_STORE_NAME, `${LAST_STARTED_ACTIVITY_KEY}:${avatarID}`);
}

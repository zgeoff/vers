import { PREFERENCES_STORE_NAME, START_STAMPS_KEY } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { StartStampsPreference } from './types';

/**
 * Persists `revealNodes`'s crypto stamps, overwriting whatever was cached before with the
 * account's current ones.
 */
export async function writeStartStamps(stamps: Readonly<StartStampsPreference>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PREFERENCES_STORE_NAME, stamps, START_STAMPS_KEY);
}

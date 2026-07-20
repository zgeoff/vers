import { PENDING_START_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { PendingStartIntent } from './types';

/**
 * Persists a continuation-start intent, overwriting whatever outstanding intent was held before.
 */
export async function writePendingStartIntent(intent: Readonly<PendingStartIntent>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PREFERENCES_STORE_NAME, intent, PENDING_START_INTENT_KEY);
}

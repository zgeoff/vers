import { PENDING_STOP_INTENT_KEY, PREFERENCES_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { PendingStopIntent } from './types';

/**
 * Persists a stop intent, overwriting whatever undelivered intent was held before.
 */
export async function writePendingStopIntent(intent: Readonly<PendingStopIntent>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PREFERENCES_STORE_NAME, intent, PENDING_STOP_INTENT_KEY);
}

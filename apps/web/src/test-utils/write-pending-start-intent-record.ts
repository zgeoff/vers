import type { PendingStartIntent } from '@vers/idle-client';
import {
  IDLE_CHECKPOINT_PREFERENCES_STORE_NAME,
  resolveIdleCheckpointDB,
} from './resolve-idle-checkpoint-db';

const PENDING_START_INTENT_KEY = 'pending-start';

/**
 * Seeds the idle worker's held continuation-start intent, so a fresh read of it during the test
 * observes this value.
 */
export async function writePendingStartIntentRecord(
  intent: Readonly<PendingStartIntent>,
): Promise<void> {
  const db = await resolveIdleCheckpointDB();

  await db.put(IDLE_CHECKPOINT_PREFERENCES_STORE_NAME, intent, PENDING_START_INTENT_KEY);
}

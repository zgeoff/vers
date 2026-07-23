import type { PendingStartIntent } from '@vers/idle-client';
import { resolveIdleCheckpointDB } from './resolve-idle-checkpoint-db';

/**
 * Mirrors the idle worker's private preferences-store key for the held intent.
 */
const PENDING_START_INTENT_KEY = 'pending-start';

/**
 * Seeds the idle worker's held continuation-start intent, so a fresh read of it during the test
 * observes this value.
 */
export async function writePendingStartIntentRecord(
  intent: Readonly<PendingStartIntent>,
): Promise<void> {
  const db = await resolveIdleCheckpointDB();

  await db.put('preferences', intent, PENDING_START_INTENT_KEY);
}

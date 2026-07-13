import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Persists one mapped checkpoint batch entry for an activity, keyed `[activityID, version]` —
 * entries are hashed once at map time, so a later resend from here is byte-identical.
 */
export async function writeQueuedCheckpoint(
  activityID: string,
  entry: Readonly<CheckpointBatchEntry>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(CHECKPOINT_QUEUE_STORE_NAME, { ...entry, activityID });
}

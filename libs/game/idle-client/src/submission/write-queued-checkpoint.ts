import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

export async function writeQueuedCheckpoint(
  activityID: string,
  entry: Readonly<CheckpointBatchEntry>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(CHECKPOINT_QUEUE_STORE_NAME, { ...entry, activityID });
}

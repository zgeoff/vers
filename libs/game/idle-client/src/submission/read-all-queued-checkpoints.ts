import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { QueuedCheckpoint } from './types';

/**
 * Reads every queued checkpoint this device holds, across every activity — the rows a flush would
 * deliver.
 */
export async function readAllQueuedCheckpoints(): Promise<Array<QueuedCheckpoint>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(CHECKPOINT_QUEUE_STORE_NAME);
}

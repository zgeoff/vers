import { CHECKPOINT_QUEUE_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { QueuedCheckpoint } from './types';

export async function readAllQueuedCheckpoints(): Promise<Array<QueuedCheckpoint>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(CHECKPOINT_QUEUE_STORE_NAME);
}

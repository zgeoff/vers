import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ROOTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads one local start's client-minted root row by its activity id, `undefined` when this device
 * holds no such row.
 */
export async function readStartRow(activityID: string): Promise<ActivityData | undefined> {
  const db = await resolveCheckpointQueueDB();

  return db.get(PENDING_ROOTS_STORE_NAME, activityID);
}

import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads one local start's client-minted activity start row by its activity id, `undefined` when
 * this device holds no such row.
 */
export async function readActivityStart(activityID: string): Promise<ActivityData | undefined> {
  const db = await resolveCheckpointQueueDB();

  return db.get(PENDING_ACTIVITY_STARTS_STORE_NAME, activityID);
}

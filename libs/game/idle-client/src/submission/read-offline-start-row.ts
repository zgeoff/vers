import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads one offline-open start's client-minted root row by its activity id, `undefined` when this
 * device holds no such row.
 */
export async function readOfflineStartRow(activityID: string): Promise<ActivityData | undefined> {
  const db = await resolveCheckpointQueueDB();

  return db.get(OFFLINE_STARTS_STORE_NAME, activityID);
}

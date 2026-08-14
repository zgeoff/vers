import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads every offline-open start row this device holds, across every avatar and activity — a
 * later reconcile's drain surface.
 */
export async function readAllOfflineStartRows(): Promise<ReadonlyArray<ActivityData>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(OFFLINE_STARTS_STORE_NAME);
}

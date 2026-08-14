import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ROOTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads every local start's client-minted root row this device holds, across every avatar and
 * activity — a later reconcile's drain surface.
 */
export async function readAllStartRows(): Promise<ReadonlyArray<ActivityData>> {
  const db = await resolveCheckpointQueueDB();

  return db.getAll(PENDING_ROOTS_STORE_NAME);
}

import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ACTIVITY_STARTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Persists a local start's client-minted activity start row, keyed by its own `id`. Called before
 * the row installs onto the live simulation, so a crash between mint and install still leaves a
 * recoverable activity start for a later reconcile to drain.
 */
export async function writeActivityStart(row: Readonly<ActivityData>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PENDING_ACTIVITY_STARTS_STORE_NAME, row);
}

import type { ActivityData } from '@vers/contract-activity';
import { PENDING_ROOTS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Persists a local start's client-minted root row, keyed by its own `id`. Called before the row
 * installs onto the live simulation, so a crash between mint and install still leaves a
 * recoverable root for a later reconcile to drain.
 */
export async function writeStartRow(row: Readonly<ActivityData>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  await db.put(PENDING_ROOTS_STORE_NAME, row);
}

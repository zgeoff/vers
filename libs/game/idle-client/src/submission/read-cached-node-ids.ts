import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads every node id this device already holds a genesis seed for, so a caller can diff a
 * revealed-frontier set down to only the nodes that still need revealing.
 */
export async function readCachedNodeIDs(): Promise<ReadonlySet<string>> {
  const db = await resolveCheckpointQueueDB();
  const keys = await db.getAllKeys(NODE_SEEDS_STORE_NAME);

  return new Set(keys);
}

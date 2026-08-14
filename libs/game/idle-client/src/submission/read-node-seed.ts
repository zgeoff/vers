import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads a world-map node's cached genesis seed, `undefined` when this device has never revealed
 * that node.
 */
export async function readNodeSeed(nodeID: string): Promise<string | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(NODE_SEEDS_STORE_NAME, nodeID);

  return record?.genesisSeed;
}

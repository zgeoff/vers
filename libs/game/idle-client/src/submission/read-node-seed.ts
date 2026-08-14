import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Reads an avatar's cached genesis seed for a world-map node, `undefined` when this device has
 * never revealed that node for that avatar.
 */
export async function readNodeSeed(avatarID: string, nodeID: string): Promise<string | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(NODE_SEEDS_STORE_NAME, [avatarID, nodeID]);

  return record?.genesisSeed;
}

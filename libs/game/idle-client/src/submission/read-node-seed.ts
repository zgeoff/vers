import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeed } from './types';

/**
 * A world-map node's cached start inputs, the avatar and node id it was read for dropped since the
 * caller already holds both.
 */
export type CachedNodeSeed = Omit<NodeSeed, 'avatarID' | 'nodeID'>;

/**
 * Reads an avatar's cached start inputs — genesis seed, encounter, and content version — for a
 * world-map node, `undefined` when this device has never revealed that node for that avatar.
 */
export async function readNodeSeed(
  avatarID: string,
  nodeID: string,
): Promise<CachedNodeSeed | undefined> {
  const db = await resolveCheckpointQueueDB();
  const record = await db.get(NODE_SEEDS_STORE_NAME, [avatarID, nodeID]);

  return record === undefined
    ? undefined
    : {
        contentVersion: record.contentVersion,
        encounterNode: record.encounterNode,
        genesisSeed: record.genesisSeed,
      };
}

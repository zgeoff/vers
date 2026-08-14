import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { RevealedNodeSeed } from './types';

/**
 * Persists a batch of one avatar's revealed world-map node start inputs in one transaction, keyed
 * by the `[avatarID, nodeID]` pair. A node already cached for this avatar is overwritten in place
 * — safe because a repeat reveal always yields that avatar's existing genesis seed, encounter, and
 * content version back, never new ones.
 */
export async function writeNodeSeeds(
  avatarID: string,
  seeds: ReadonlyArray<RevealedNodeSeed>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  await Promise.all([
    ...seeds.map((seed) =>
      tx.store.put({
        avatarID,
        contentVersion: seed.contentVersion,
        encounterNode: seed.encounterNode,
        genesisSeed: seed.genesisSeed,
        nodeID: seed.nodeID,
      }),
    ),
    tx.done,
  ]);
}

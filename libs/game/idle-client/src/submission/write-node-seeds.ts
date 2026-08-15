import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { RevealedNodeSeed } from './types';

/**
 * Persists a batch of one avatar's revealed world-map node start inputs in one transaction, keyed
 * by the `[avatarID, nodeID]` pair. A node already cached for this avatar is overwritten in place
 * — safe for its genesis seed, encounter, and content version, since a repeat reveal always yields
 * that avatar's existing values back, never new ones. `head` is the one exception: the reveal's
 * head only overwrites the cached one when it is at least as far advanced, so a reveal racing
 * behind this device's own local play — the server has not yet learned of checkpoints this device
 * already appended locally — never rolls the cached head backward.
 */
export async function writeNodeSeeds(
  avatarID: string,
  seeds: ReadonlyArray<RevealedNodeSeed>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  await Promise.all([
    ...seeds.map(async (seed) => {
      const existing = await tx.store.get([avatarID, seed.nodeID]);

      const head =
        existing?.head !== undefined && existing.head.chainIndex > seed.head.chainIndex
          ? existing.head
          : seed.head;

      await tx.store.put({
        avatarID,
        contentVersion: seed.contentVersion,
        encounterNode: seed.encounterNode,
        genesisSeed: seed.genesisSeed,
        head,
        nodeID: seed.nodeID,
      });
    }),
    tx.done,
  ]);
}

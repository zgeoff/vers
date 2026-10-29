import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { RevealedNodeSeed } from './types';

export async function writeNodeSeeds(
  avatarID: string,
  seeds: ReadonlyArray<RevealedNodeSeed>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  await Promise.all([
    ...seeds.map(async (seed) => {
      const existing = await tx.store.get([avatarID, seed.nodeID]);

      // a server that deleted and re-revealed the chain gave it a new random genesis seed, so an
      // anchor cached under the old one names positions the server no longer holds
      const anchor =
        existing?.anchor !== undefined &&
        existing.genesisSeed === seed.genesisSeed &&
        existing.anchor.chainIndex > seed.anchor.chainIndex
          ? existing.anchor
          : seed.anchor;

      await tx.store.put({
        avatarID,
        contentVersion: seed.contentVersion,
        encounterNode: seed.encounterNode,
        genesisSeed: seed.genesisSeed,
        anchor,
        nodeID: seed.nodeID,
      });
    }),
    tx.done,
  ]);
}

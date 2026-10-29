import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import { runAtomicWrites } from './run-atomic-writes';
import type { NodeSeedAnchor } from './types';

export async function writeRewoundNodeAnchor(
  avatarID: string,
  nodeID: string,
  anchor: Readonly<NodeSeedAnchor>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  const existing = await tx.store.get([avatarID, nodeID]);

  const writes =
    existing === undefined || existing.anchor.chainIndex <= anchor.chainIndex
      ? []
      : [() => tx.store.put({ ...existing, anchor })];

  await runAtomicWrites(tx, writes);
}

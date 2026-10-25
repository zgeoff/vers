import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeedAnchor } from './types';

export async function writeServerNodeAnchor(
  avatarID: string,
  nodeID: string,
  anchor: Readonly<NodeSeedAnchor>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  const existing = await tx.store.get([avatarID, nodeID]);

  if (existing === undefined) {
    await tx.done;

    return;
  }

  await Promise.all([tx.store.put({ ...existing, anchor }), tx.done]);
}

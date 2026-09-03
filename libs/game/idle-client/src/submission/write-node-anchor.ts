import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeedAnchor } from './types';

export async function writeNodeAnchor(
  avatarID: string,
  nodeID: string,
  anchor: Readonly<NodeSeedAnchor>,
): Promise<void> {
  try {
    const db = await resolveCheckpointQueueDB();

    const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

    const existing = await tx.store.get([avatarID, nodeID]);

    if (existing === undefined || existing.anchor.chainIndex > anchor.chainIndex) {
      // settle the transaction inside the try, so an abort rejects where the catch below swallows
      // it rather than escaping this best-effort call as an unhandled rejection
      await tx.done;

      return;
    }

    await Promise.all([tx.store.put({ ...existing, anchor }), tx.done]);
  } catch {
    // best-effort: a lost anchor update self-heals on the node's next reveal
  }
}

import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeedAnchor } from './types';

/**
 * Advances a cached node's anchor in place as the client appends further into its seed chain, so a
 * later start at the same scope anchors against the position this device has actually reached
 * rather than the node's genesis. The advance is monotonic: an incoming anchor at least as far
 * along as the cached one wins, an earlier one is discarded, so an out-of-order or delayed
 * lower-index write never regresses the cache to an already-consumed position. The read, compare,
 * and write run in one transaction, so concurrent advances serialize rather than racing on a stale
 * read. Best-effort and non-throwing: a write failure is swallowed rather than propagated, since
 * losing this cache update must never interrupt checkpoint submission — the node simply falls back
 * to a stale anchor until its next reveal. A no-op when the node was never cached for this avatar,
 * which a caller submitting against a registered activity should not be able to reach in practice.
 */
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
      return;
    }

    await Promise.all([tx.store.put({ ...existing, anchor }), tx.done]);
  } catch {
    // best-effort: a lost anchor update self-heals on the node's next reveal
  }
}

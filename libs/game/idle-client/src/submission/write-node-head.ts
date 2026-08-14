import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeedHead } from './types';

/**
 * Advances a cached node's head in place as the client appends further into its chain, so a later
 * start at the same scope roots against the position this device has actually reached rather than
 * the node's genesis. The advance is monotonic: an incoming head at least as far along as the
 * cached one wins, an earlier one is discarded, so an out-of-order or delayed lower-index write
 * never regresses the cache to an already-consumed position. The read, compare, and write run in
 * one transaction, so concurrent advances serialize rather than racing on a stale read.
 * Best-effort and non-throwing: a write failure is swallowed rather than propagated, since losing
 * this cache update must never interrupt checkpoint submission — the node simply falls back to a
 * stale head until its next reveal. A no-op when the node was never cached for this avatar, which
 * a caller submitting against a registered activity should not be able to reach in practice.
 */
export async function writeNodeHead(
  avatarID: string,
  nodeID: string,
  head: Readonly<NodeSeedHead>,
): Promise<void> {
  try {
    const db = await resolveCheckpointQueueDB();

    const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

    const existing = await tx.store.get([avatarID, nodeID]);

    if (existing === undefined || existing.head.chainIndex > head.chainIndex) {
      return;
    }

    await Promise.all([tx.store.put({ ...existing, head }), tx.done]);
  } catch {
    // best-effort: a lost head update self-heals on the node's next reveal
  }
}

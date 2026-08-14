import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeed } from './types';

/**
 * Persists a batch of revealed world-map node seeds in one transaction, keyed by node id. A node
 * already cached is overwritten in place — safe because a repeat reveal always yields the node's
 * existing genesis seed back, never a new one.
 */
export async function writeNodeSeeds(seeds: ReadonlyArray<NodeSeed>): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  await Promise.all([...seeds.map((seed) => tx.store.put(seed)), tx.done]);
}

import type { NodeSeed } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';

interface CacheNodeSeedsInput {
  readonly seeds: ReadonlyArray<NodeSeed>;
}

/**
 * Persists a tab-relayed batch of revealed world-map node seeds to the worker's durable cache.
 */
export async function handleCacheNodeSeedsMessage(
  input: Readonly<CacheNodeSeedsInput>,
): Promise<void> {
  await writeNodeSeeds(input.seeds);
}

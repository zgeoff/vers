import type { RevealedNodeSeed } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';

interface CacheNodeSeedsInput {
  readonly avatarID: string;
  readonly seeds: ReadonlyArray<RevealedNodeSeed>;
}

/**
 * Persists a tab-relayed batch of one avatar's revealed world-map node seeds to the worker's
 * durable cache, scoping every row to the batch's avatar.
 */
export async function handleCacheNodeSeedsMessage(
  input: Readonly<CacheNodeSeedsInput>,
): Promise<void> {
  await writeNodeSeeds(input.avatarID, input.seeds);
}

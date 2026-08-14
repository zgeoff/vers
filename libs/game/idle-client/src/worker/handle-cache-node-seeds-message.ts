import type { RevealedNodeSeed, StartStampsPreference } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';

interface CacheNodeSeedsInput {
  readonly avatarID: string;
  readonly seeds: ReadonlyArray<RevealedNodeSeed>;
  readonly stamps: StartStampsPreference;
}

/**
 * Persists a tab-relayed batch of one avatar's revealed world-map node start inputs to the
 * worker's durable cache, scoping every node row to the batch's avatar, and overwrites the cached
 * crypto stamps with the batch's — the account's current ones regardless of which avatar revealed
 * them.
 */
export async function handleCacheNodeSeedsMessage(
  input: Readonly<CacheNodeSeedsInput>,
): Promise<void> {
  await Promise.all([writeNodeSeeds(input.avatarID, input.seeds), writeStartStamps(input.stamps)]);
}

import type { RevealedNodeSeed, StartStampsPreference } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';

interface CacheNodeSeedsInput {
  readonly avatarID: string;
  readonly seeds: ReadonlyArray<RevealedNodeSeed>;
  readonly stamps: StartStampsPreference;
}

export async function handleCacheNodeSeedsMessage(
  input: Readonly<CacheNodeSeedsInput>,
): Promise<void> {
  await Promise.all([writeNodeSeeds(input.avatarID, input.seeds), writeStartStamps(input.stamps)]);
}

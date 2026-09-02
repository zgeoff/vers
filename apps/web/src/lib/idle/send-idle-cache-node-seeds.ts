import type { RevealedNodeSeed, StartStampsPreference, WorkerClient } from '@vers/idle-client';

interface SendIdleCacheNodeSeedsInput {
  readonly avatarID: string;
  readonly seeds: ReadonlyArray<RevealedNodeSeed>;
  readonly stamps: StartStampsPreference;
}

export async function sendIdleCacheNodeSeeds(
  client: WorkerClient,
  input: Readonly<SendIdleCacheNodeSeedsInput>,
  signal: AbortSignal,
): Promise<void> {
  await client.cacheNodeSeeds(input, { signal });
}

import type { RevealedNodeSeed, WorkerClient } from '@vers/idle-client';

interface SendIdleCacheNodeSeedsInput {
  readonly avatarID: string;
  readonly seeds: ReadonlyArray<RevealedNodeSeed>;
}

/**
 * Relays a batch of one avatar's freshly revealed genesis seeds to the worker, which persists them
 * to its durable on-device cache scoped to that avatar.
 */
export async function sendIdleCacheNodeSeeds(
  client: WorkerClient,
  input: Readonly<SendIdleCacheNodeSeedsInput>,
  signal: AbortSignal,
): Promise<void> {
  await client.cacheNodeSeeds(input, { signal });
}

import type { NodeSeed, WorkerClient } from '@vers/idle-client';

interface SendIdleCacheNodeSeedsInput {
  readonly seeds: ReadonlyArray<NodeSeed>;
}

/**
 * Relays a batch of freshly revealed genesis seeds to the worker, which persists them to its
 * durable on-device cache.
 */
export async function sendIdleCacheNodeSeeds(
  client: WorkerClient,
  input: Readonly<SendIdleCacheNodeSeedsInput>,
  signal: AbortSignal,
): Promise<void> {
  await client.cacheNodeSeeds(input, { signal });
}

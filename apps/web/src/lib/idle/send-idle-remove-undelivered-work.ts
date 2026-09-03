import type { WorkerClient } from '@vers/idle-client';

export async function sendIdleRemoveUndeliveredWork(
  client: WorkerClient,
  signal: AbortSignal,
): Promise<void> {
  await client.removeUndeliveredWork({}, { signal });
}

import type { WorkerClient } from '@vers/idle-client';

/**
 * Tells the worker to discard this device's undelivered offline work: its pending activity starts,
 * queued checkpoints, and the run it is currently simulating, if any.
 */
export async function sendIdleRemoveUndeliveredWork(
  client: WorkerClient,
  signal: AbortSignal,
): Promise<void> {
  await client.removeUndeliveredWork({}, { signal });
}

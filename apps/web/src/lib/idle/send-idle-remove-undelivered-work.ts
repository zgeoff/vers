import type { WorkerClient } from '@vers/idle-client';

export async function sendIdleRemoveUndeliveredWork(
  client: WorkerClient,
  avatarIDs: ReadonlyArray<string>,
  signal: AbortSignal,
): Promise<void> {
  await client.removeUndeliveredWork({ avatarIDs }, { signal });
}

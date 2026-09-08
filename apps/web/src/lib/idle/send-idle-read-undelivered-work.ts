import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';

export function sendIdleReadUndeliveredWork(
  client: WorkerClient,
  avatarIDs: ReadonlyArray<string>,
  signal: AbortSignal,
): Promise<UndeliveredWork> {
  return client.readUndeliveredWork({ avatarIDs }, { signal });
}

import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';

export function sendIdleReadUndeliveredWork(
  client: WorkerClient,
  signal: AbortSignal,
): Promise<UndeliveredWork> {
  return client.readUndeliveredWork({}, { signal });
}

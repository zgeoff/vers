import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';

/**
 * Asks the worker what this device holds that the server has never verified: the pending activity
 * starts and queued checkpoints in its durable stores, plus the activity it is currently running.
 */
export function sendIdleReadUndeliveredWork(
  client: WorkerClient,
  signal: AbortSignal,
): Promise<UndeliveredWork> {
  return client.readUndeliveredWork({}, { signal });
}

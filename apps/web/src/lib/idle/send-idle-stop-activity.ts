import type { WorkerClient } from '@vers/idle-client';

/**
 * Tells the worker to end the named run. The worker halts the local simulation immediately and
 * owns delivery of the server stop — flushing earned checkpoints first and retrying from a durable
 * intent on later reconnects — so the caller never awaits the server and the stop works offline.
 */
export async function sendIdleStopActivity(
  client: WorkerClient,
  avatarID: string,
  activityID: string,
  signal: AbortSignal,
): Promise<void> {
  await client.stopActivity({ activityID, avatarID }, { signal });
}

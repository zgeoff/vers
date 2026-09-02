import type { WorkerClient } from '@vers/idle-client';

export async function sendIdleStopActivity(
  client: WorkerClient,
  avatarID: string,
  activityID: string,
  signal: AbortSignal,
): Promise<void> {
  await client.stopActivity({ activityID, avatarID }, { signal });
}

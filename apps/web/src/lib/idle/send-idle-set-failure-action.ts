import type { WorkerClient } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export async function sendIdleSetFailureAction(
  client: WorkerClient,
  avatarID: string,
  failureAction: ActivityFailureAction,
  signal: AbortSignal,
): Promise<void> {
  await client.setFailureAction({ avatarID, failureAction }, { signal });
}

import type { WorkerClient } from '@vers/idle-client';

export async function sendIdleReportOnline(
  client: WorkerClient,
  avatarID: string,
  claim: boolean,
  signal: AbortSignal,
): Promise<void> {
  await client.reportOnline({ avatarID, claim }, { signal });
}

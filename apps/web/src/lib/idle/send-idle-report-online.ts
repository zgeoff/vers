import type { WorkerClient } from '@vers/idle-client';

/**
 * `claim` marks a deliberate presence that may take over as an active run's writer — a page load,
 * an explicit continue or retry. Automatic triggers (a reconnect relay, a writer succession) pass
 * `false` so they can never steal the writer from a device the player is actively driving.
 */
export async function sendIdleReportOnline(
  client: WorkerClient,
  avatarID: string,
  claim: boolean,
  signal: AbortSignal,
): Promise<void> {
  await client.reportOnline({ avatarID, claim }, { signal });
}

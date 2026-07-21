import type { ClientMessage, SimulationTransport } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';

/**
 * `claim` marks a deliberate presence that may take over as an active run's writer — a page load,
 * an explicit continue or retry. Automatic triggers (a reconnect relay, a writer succession) pass
 * `false` so they can never steal the writer from a device the player is actively driving.
 */
export function sendIdleReportOnline(
  transport: SimulationTransport,
  avatarID: string,
  claim: boolean,
): void {
  transport.post({
    avatarID,
    claim,
    type: ClientMessageType.ReportOnline,
  } satisfies ClientMessage);
}

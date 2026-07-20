import { createRequestResyncMessage } from '@vers/idle-client';

/**
 * `claim` marks a deliberate attach that may take over as an active run's writer — a page load,
 * an explicit continue or retry. Automatic triggers (a reconnect relay) pass `false` so they can
 * never steal the writer from a device the player is actively driving.
 */
export function sendIdleRequestResync(
  worker: Pick<SharedWorker, 'port'>,
  avatarID: string,
  claim: boolean,
): void {
  worker.port.postMessage(createRequestResyncMessage(avatarID, claim));
}

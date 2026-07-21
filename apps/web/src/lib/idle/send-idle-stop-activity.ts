import type { ClientMessage, SimulationTransport } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';

/**
 * Tells the worker to end the named run. The worker halts the local simulation immediately and
 * owns delivery of the server stop — flushing earned checkpoints first and retrying from a durable
 * intent on later reconnects — so the caller never awaits the server and the stop works offline.
 */
export function sendIdleStopActivity(
  transport: SimulationTransport,
  avatarID: string,
  activityID: string,
): void {
  transport.post({
    activityID,
    avatarID,
    type: ClientMessageType.StopActivity,
  } satisfies ClientMessage);
}

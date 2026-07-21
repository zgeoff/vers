import type { ClientMessage, SimulationTransport } from '@vers/idle-client';
import { ClientMessageType } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export function sendIdleSetFailureAction(
  transport: SimulationTransport,
  avatarID: string,
  failureAction: ActivityFailureAction,
): void {
  transport.post({
    avatarID,
    failureAction,
    type: ClientMessageType.SetFailureAction,
  } satisfies ClientMessage);
}

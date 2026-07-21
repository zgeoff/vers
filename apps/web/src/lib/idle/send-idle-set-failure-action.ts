import type { SimulationTransport } from '@vers/idle-client';
import { createSetFailureActionMessage } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export function sendIdleSetFailureAction(
  transport: SimulationTransport,
  avatarID: string,
  failureAction: ActivityFailureAction,
): void {
  transport.post(createSetFailureActionMessage(avatarID, failureAction));
}

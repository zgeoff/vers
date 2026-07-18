import { createSetFailureActionMessage } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export function sendIdleSetFailureAction(
  worker: Pick<SharedWorker, 'port'>,
  avatarID: string,
  failureAction: ActivityFailureAction,
): void {
  worker.port.postMessage(createSetFailureActionMessage(avatarID, failureAction));
}

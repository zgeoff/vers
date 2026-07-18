import { createSetFailureActionMessage } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export function sendIdleSetFailureAction(
  worker: Pick<SharedWorker, 'port'>,
  failureAction: ActivityFailureAction,
): void {
  worker.port.postMessage(createSetFailureActionMessage(failureAction));
}

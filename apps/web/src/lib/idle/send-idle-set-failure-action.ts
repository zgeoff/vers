import { createSetFailureActionMessage } from '@vers/idle-client';
import type { ActivityFailureAction } from '@vers/idle-core';

export function sendIdleSetFailureAction(
  worker: SharedWorker,
  failureAction: ActivityFailureAction,
): void {
  worker.port.postMessage(createSetFailureActionMessage(failureAction));
}

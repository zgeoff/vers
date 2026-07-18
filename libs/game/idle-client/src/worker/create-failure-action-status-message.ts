import type { ActivityFailureAction } from '@vers/idle-core';
import type { FailureActionStatusMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createFailureActionStatusMessage(
  failureAction: ActivityFailureAction,
): FailureActionStatusMessage {
  return { failureAction, type: WorkerMessageType.FailureActionStatus };
}

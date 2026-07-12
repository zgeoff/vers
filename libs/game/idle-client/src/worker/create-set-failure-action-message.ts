import type { ActivityFailureAction } from '@vers/idle-core';
import type { SetFailureActionMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetFailureActionMessage(
  failureAction: ActivityFailureAction,
): SetFailureActionMessage {
  return {
    failureAction,
    type: ClientMessageType.SetFailureAction,
  };
}

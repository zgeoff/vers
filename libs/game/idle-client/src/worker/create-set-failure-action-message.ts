import type { ActivityFailureAction } from '@vers/idle-core';
import type { SetFailureActionMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetFailureActionMessage(
  avatarID: string,
  failureAction: ActivityFailureAction,
): SetFailureActionMessage {
  return {
    avatarID,
    failureAction,
    type: ClientMessageType.SetFailureAction,
  };
}

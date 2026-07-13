import type { ActivityInput, AvatarData } from '@vers/idle-core';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetActivityMessage(
  activity: ActivityInput,
  avatar: AvatarData,
): SetActivityMessage {
  return {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };
}

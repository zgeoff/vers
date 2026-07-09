import type { ActivityData, AvatarData } from '@vers/idle-core';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetActivityMessage(
  activity: ActivityData,
  avatar: AvatarData,
): SetActivityMessage {
  return {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };
}

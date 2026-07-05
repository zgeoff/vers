import type { ActivityData, AvatarData } from '@vers/idle-core';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetActivityMessage(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  activity: ActivityData,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  avatar: AvatarData,
): SetActivityMessage {
  return {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };
}

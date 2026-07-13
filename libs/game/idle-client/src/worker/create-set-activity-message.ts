import type { ActivityInput, AvatarData } from '@vers/idle-core';
import type { ActivitySubmissionContext } from '../submission/types';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetActivityMessage(
  activity: ActivityInput,
  avatar: AvatarData,
  submission?: ActivitySubmissionContext,
): SetActivityMessage {
  return {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
    ...(submission && { submission }),
  };
}

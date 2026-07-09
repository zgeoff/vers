import { createSetActivityMessage } from '@vers/idle-client';
import type { ActivityData, AvatarData } from '@vers/idle-core';

export function sendIdleSetActivity(
  worker: SharedWorker,
  activity: ActivityData,
  avatar: AvatarData,
): void {
  worker.port.postMessage(createSetActivityMessage(activity, avatar));
}

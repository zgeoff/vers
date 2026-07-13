import { createSetActivityMessage } from '@vers/idle-client';
import type { ActivityInput, AvatarData } from '@vers/idle-core';

export function sendIdleSetActivity(
  worker: SharedWorker,
  activity: ActivityInput,
  avatar: AvatarData,
): void {
  worker.port.postMessage(createSetActivityMessage(activity, avatar));
}

import { createSetActivityMessage } from '@vers/idle-client';
import type { ActivityData, AvatarData } from '@vers/idle-core';

/** Tells the worker which activity the acting avatar is now running. */
export function sendIdleSetActivity(
  worker: SharedWorker,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @vers/idle-core's ActivityData/AvatarData nest mutable arrays (enemy groups, equipment); framework types with no readonly form
  activity: ActivityData,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @vers/idle-core's ActivityData/AvatarData nest mutable arrays (enemy groups, equipment); framework types with no readonly form
  avatar: AvatarData,
): void {
  worker.port.postMessage(createSetActivityMessage(activity, avatar));
}

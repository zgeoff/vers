import type { StopActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createStopActivityMessage(
  avatarID: string,
  activityID: string,
): StopActivityMessage {
  return { activityID, avatarID, type: ClientMessageType.StopActivity };
}

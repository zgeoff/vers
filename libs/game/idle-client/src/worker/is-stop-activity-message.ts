import type { ClientMessage, StopActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function isStopActivityMessage(message: ClientMessage): message is StopActivityMessage {
  return message.type === ClientMessageType.StopActivity;
}

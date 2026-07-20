import type { ClientMessage, StartActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function isStartActivityMessage(message: ClientMessage): message is StartActivityMessage {
  return message.type === ClientMessageType.StartActivity;
}

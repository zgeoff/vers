import type { ClientMessage, SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function isSetActivityMessage(message: ClientMessage): message is SetActivityMessage {
  return message.type === ClientMessageType.SetActivity;
}

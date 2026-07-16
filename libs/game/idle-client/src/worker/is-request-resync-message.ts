import type { ClientMessage, RequestResyncMessage } from '../types';
import { ClientMessageType } from '../types';

export function isRequestResyncMessage(message: ClientMessage): message is RequestResyncMessage {
  return message.type === ClientMessageType.RequestResync;
}

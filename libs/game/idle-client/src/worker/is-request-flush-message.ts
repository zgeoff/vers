import type { ClientMessage, RequestFlushMessage } from '../types';
import { ClientMessageType } from '../types';

export function isRequestFlushMessage(message: ClientMessage): message is RequestFlushMessage {
  return message.type === ClientMessageType.RequestFlush;
}

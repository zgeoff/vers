import type { ClientMessage, InitializeMessage } from '../types';
import { ClientMessageType } from '../types';

export function isInitializeMessage(message: ClientMessage): message is InitializeMessage {
  return message.type === ClientMessageType.Initialize;
}

import type { ClientMessage, DisconnectMessage } from '../types';
import { ClientMessageType } from '../types';

export function isDisconnectMessage(message: ClientMessage): message is DisconnectMessage {
  return message.type === ClientMessageType.Disconnect;
}

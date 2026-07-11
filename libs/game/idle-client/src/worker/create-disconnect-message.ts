import type { DisconnectMessage } from '../types';
import { ClientMessageType } from '../types';

export function createDisconnectMessage(): DisconnectMessage {
  return {
    type: ClientMessageType.Disconnect,
  };
}

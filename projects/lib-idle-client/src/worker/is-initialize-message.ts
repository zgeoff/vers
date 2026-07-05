import type { ClientMessage, InitializeMessage } from '../types';
import { ClientMessageType } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function isInitializeMessage(message: ClientMessage): message is InitializeMessage {
  return message.type === ClientMessageType.Initialize;
}

import type { ClientMessage, SetFailureActionMessage } from '../types';
import { ClientMessageType } from '../types';

export function isSetFailureActionMessage(
  message: ClientMessage,
): message is SetFailureActionMessage {
  return message.type === ClientMessageType.SetFailureAction;
}

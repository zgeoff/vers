import type { ClientMessage, SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function isSetActivityMessage(message: ClientMessage): message is SetActivityMessage {
  return message.type === ClientMessageType.SetActivity;
}

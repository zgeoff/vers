import type { ActivityData } from '@vers/contract-activity';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';

export function createSetActivityMessage(activity: Readonly<ActivityData>): SetActivityMessage {
  return { activity, type: ClientMessageType.SetActivity };
}

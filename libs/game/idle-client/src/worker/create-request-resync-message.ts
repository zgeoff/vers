import type { RequestResyncMessage } from '../types';
import { ClientMessageType } from '../types';

export function createRequestResyncMessage(avatarID: string, claim: boolean): RequestResyncMessage {
  return { avatarID, claim, type: ClientMessageType.RequestResync };
}

import type { RequestResyncMessage } from '../types';
import { ClientMessageType } from '../types';

export function createRequestResyncMessage(avatarID: string): RequestResyncMessage {
  return { avatarID, type: ClientMessageType.RequestResync };
}

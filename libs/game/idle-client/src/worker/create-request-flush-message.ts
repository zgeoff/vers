import type { RequestFlushMessage } from '../types';
import { ClientMessageType } from '../types';

export function createRequestFlushMessage(
  activityID: string,
  requestID: string,
): RequestFlushMessage {
  return { activityID, requestID, type: ClientMessageType.RequestFlush };
}

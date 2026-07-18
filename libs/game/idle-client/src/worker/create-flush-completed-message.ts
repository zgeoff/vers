import type { FlushCompletedMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createFlushCompletedMessage(
  activityID: string,
  requestID: string,
): FlushCompletedMessage {
  return { activityID, requestID, type: WorkerMessageType.FlushCompleted };
}

import type { ActivityCompletedMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createActivityCompletedMessage(activityID: string): ActivityCompletedMessage {
  return {
    activityID,
    type: WorkerMessageType.ActivityCompleted,
  };
}

import type { CheckpointFlushStalledMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createCheckpointFlushStalledMessage(
  activityID: string,
  reason: string,
  traceID: string,
): CheckpointFlushStalledMessage {
  return {
    activityID,
    reason,
    traceID,
    type: WorkerMessageType.CheckpointFlushStalled,
  };
}

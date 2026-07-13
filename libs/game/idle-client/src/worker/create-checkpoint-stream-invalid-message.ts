import type { CheckpointStreamInvalidMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createCheckpointStreamInvalidMessage(
  activityID: string,
  reason: string,
): CheckpointStreamInvalidMessage {
  return {
    activityID,
    reason,
    type: WorkerMessageType.CheckpointStreamInvalid,
  };
}

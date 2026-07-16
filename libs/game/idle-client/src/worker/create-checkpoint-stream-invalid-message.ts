import type { CheckpointStreamInvalidMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createCheckpointStreamInvalidMessage(
  activityID: string,
  reason: string,
  traceID?: string,
): CheckpointStreamInvalidMessage {
  return {
    activityID,
    reason,
    ...(traceID === undefined ? {} : { traceID }),
    type: WorkerMessageType.CheckpointStreamInvalid,
  };
}

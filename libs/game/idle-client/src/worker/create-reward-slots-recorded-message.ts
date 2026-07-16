import type { RewardSlotsRecordedMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createRewardSlotsRecordedMessage(
  activityID: string,
  version: number,
  rewardSlotCount: number,
): RewardSlotsRecordedMessage {
  return {
    activityID,
    rewardSlotCount,
    type: WorkerMessageType.RewardSlotsRecorded,
    version,
  };
}

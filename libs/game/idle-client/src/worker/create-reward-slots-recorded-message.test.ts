import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createRewardSlotsRecordedMessage } from './create-reward-slots-recorded-message';

test('it carries the activity, version, and reward-slot count', () => {
  const message = createRewardSlotsRecordedMessage('activity_1', 3, 5);

  expect(message).toStrictEqual({
    activityID: 'activity_1',
    rewardSlotCount: 5,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 3,
  });
});

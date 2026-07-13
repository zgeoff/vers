import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { buildFailureXPLoss } from '../../progression';
import { createMockActivityInput } from '../../test-utils/create-mock-activity-input';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { createActivity } from '../create-activity';
import { createFailedCheckpoint } from './create-failed-checkpoint';

test('it creates a failed checkpoint with no loss at zero accrued xp', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.elapseTime(2500);

  const checkpoint = createFailedCheckpoint(activity, avatar, ctx);

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    time: 2500,
    type: ActivityCheckpointType.Failed,
  });
});

test('it subtracts the clamped failure loss from accrued rewards', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 40 });

  const checkpoint = createFailedCheckpoint(activity, avatar, ctx);
  const loss = buildFailureXPLoss(40);

  expect(checkpoint.rewards).toStrictEqual({ xp: 40 - loss });
  expect(loss).toBeGreaterThan(0);
});

test('it never carries a levelUp', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 100 });

  const checkpoint = createFailedCheckpoint(activity, avatar, ctx);

  expect(checkpoint.levelUp).toBeUndefined();
});

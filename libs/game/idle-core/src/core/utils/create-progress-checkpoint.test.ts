import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { createActivity } from '../create-activity';
import { createProgressCheckpoint } from './create-progress-checkpoint';

test('it creates a progress checkpoint', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);

  activity.advanceTime(2500);
  activity.updateRewards({ xp: 15 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 15 }, [{ nodeTier: 1 }]);

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 15 },
    rewardSlots: [{ context: { nodeTier: 1 }, ordinal: 0 }],
    time: 2500,
    type: ActivityCheckpointType.Progress,
  });
});

test('it numbers reward slots 0-contiguous across contexts from multiple waves', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);

  activity.updateRewards({ xp: 0 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 0 }, [
    { nodeTier: 2 },
    { nodeTier: 2 },
    { nodeTier: 3 },
  ]);

  expect(checkpoint.rewardSlots).toStrictEqual([
    { context: { nodeTier: 2 }, ordinal: 0 },
    { context: { nodeTier: 2 }, ordinal: 1 },
    { context: { nodeTier: 3 }, ordinal: 2 },
  ]);
});

test('it carries a levelUp when the reward delta crosses a level threshold', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 100 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 100 }, []);

  expect(checkpoint.levelUp).toStrictEqual({ from: 1, to: 2 });
});

test('it omits levelUp when the reward delta stays within the current level', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityInput();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 1 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 1 }, []);

  expect(checkpoint.levelUp).toBeUndefined();
});

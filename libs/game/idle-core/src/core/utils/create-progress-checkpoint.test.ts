import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';
import { createActivity } from '../create-activity';
import { createProgressCheckpoint } from './create-progress-checkpoint';

test('it creates a progress checkpoint', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);

  activity.elapseTime(2500);
  activity.updateRewards({ xp: 15 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 15 });

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 15 },
    time: 2500,
    type: ActivityCheckpointType.Progress,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);

  activity.elapseTime(2500);
  activity.updateRewards({ xp: 15 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 15 });
  const { hash, rewards, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});

test('it produces the same hash for checkpoints that differ only by rewards', () => {
  const activityData = createMockActivityData();
  const avatarData = createMockAvatarData();
  const ctxWithNoRewards = createMockSimulationContext();
  const activityWithNoRewards = createActivity(activityData, ctxWithNoRewards);
  const avatarWithNoRewards = createAvatar(avatarData, ctxWithNoRewards);

  activityWithNoRewards.elapseTime(2500);

  const withNoRewards = createProgressCheckpoint(
    activityWithNoRewards,
    avatarWithNoRewards,
    ctxWithNoRewards,
    { xp: 0 },
  );

  const ctxWithRewards = createMockSimulationContext();
  const activityWithRewards = createActivity(activityData, ctxWithRewards);
  const avatarWithRewards = createAvatar(avatarData, ctxWithRewards);

  activityWithRewards.elapseTime(2500);
  activityWithRewards.updateRewards({ xp: 15 });

  const withRewards = createProgressCheckpoint(
    activityWithRewards,
    avatarWithRewards,
    ctxWithRewards,
    { xp: 15 },
  );

  expect(withRewards.hash).toStrictEqual(withNoRewards.hash);
});

test('it carries a levelUp when the reward delta crosses a level threshold', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 100 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 100 });

  expect(checkpoint.levelUp).toStrictEqual({ from: 1, to: 2 });
});

test('it omits levelUp when the reward delta stays within the current level', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 1 });

  const checkpoint = createProgressCheckpoint(activity, avatar, ctx, { xp: 1 });

  expect(checkpoint.levelUp).toBeUndefined();
});

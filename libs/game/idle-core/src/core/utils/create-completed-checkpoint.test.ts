import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { buildCompletionXP } from '../../progression';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';
import { createActivity } from '../create-activity';
import { createCompletedCheckpoint } from './create-completed-checkpoint';

test('it creates a completed checkpoint with the completion bonus', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData({ difficulty: 1 });
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.elapseTime(2500);

  const checkpoint = createCompletedCheckpoint(activity, avatar, ctx);

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: buildCompletionXP(1) },
    time: 2500,
    type: ActivityCheckpointType.Completed,
  });
});

test('it includes a hash based on checkpoint data', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);

  activity.elapseTime(2500);

  const checkpoint = createCompletedCheckpoint(activity, avatar, ctx);
  const { hash, rewards, ...hashParts } = checkpoint;

  expect(hash).toStrictEqual(hashObject(ctx.hasher, hashParts));
});

test('it merges the completion bonus with rewards already accrued', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 40 });

  const checkpoint = createCompletedCheckpoint(activity, avatar, ctx);

  expect(checkpoint.rewards).toStrictEqual({ xp: 40 + buildCompletionXP(1) });
});

test('it carries a levelUp when the completion bonus crosses a level threshold', () => {
  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(createMockAvatarData({ xp: 0 }), ctx);

  activity.updateRewards({ xp: 90 });

  const checkpoint = createCompletedCheckpoint(activity, avatar, ctx);

  expect(checkpoint.levelUp).toStrictEqual({ from: 1, to: 2 });
});

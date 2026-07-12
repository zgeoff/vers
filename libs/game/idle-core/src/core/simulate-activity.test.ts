import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createAvatar } from '../entities/create-avatar';
import { buildCompletionXP, levelForXP } from '../progression';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  ActivityType,
  EquipmentSlot,
} from '../types';
import type { EquipmentWeapon } from '../types';
import { createActivity } from './create-activity';
import { createCombatExecutor } from './create-combat-executor';
import { simulateActivity } from './simulate-activity';

test('it immediately generates a started checkpoint', async () => {
  const avatarData = createMockAvatarData();
  const enemyData = createMockEnemyData();

  const activityData = createMockActivityData({
    enemies: [enemyData],
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  const firstResult = await generator.next();

  const firstCheckpoint = firstResult.value;

  expect(firstCheckpoint).toStrictEqual({
    hash: expect.toBeString(),
    rewards: { xp: 0 },
    seed: 999_999_999,
    time: 0,
    type: ActivityCheckpointType.Started,
  });
});

test('it generates enemy group killed checkpoints', async () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 6,
  };

  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
  });

  // low enough that two cleared groups stay well under a level threshold — this test is about
  // checkpoint mechanics, not leveling
  const enemyData = createMockEnemyData({ life: 1, xp: 1 });

  const activityData = createMockActivityData({
    enemies: [enemyData],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_node_1',
    type: ActivityType.WorldNode,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupSize: 5 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  const secondResult = await generator.next(1000);

  const secondCheckpoint = secondResult.value;

  const thirdResult = await generator.next(1000);

  const thirdCheckpoint = thirdResult.value;

  await generator.next(1000);

  expect(secondCheckpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 5 },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });

  expect(thirdCheckpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 5 },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it accrues rewards across multiple cleared groups', async () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 6,
  };

  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
  });

  const enemyData = createMockEnemyData({ life: 1, xp: 10 });

  const activityData = createMockActivityData({
    enemies: [enemyData],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_node_1',
    type: ActivityType.WorldNode,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupCount: 2, groupSize: 5 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  // clear the first group
  await generator.next(1000);

  expect(activity.rewards).toStrictEqual({ xp: 50 });

  // clear the second group
  await generator.next(1000);

  expect(activity.rewards).toStrictEqual({ xp: 100 });
});

test('it generates a failed checkpoint when the avatar dies', async () => {
  const avatarData = createMockAvatarData({ life: 1 });

  const enemyData = createMockEnemyData({
    life: 9999,
    primaryAttack: {
      maxDamage: 9999,
      minDamage: 9999,
      speed: 1,
    },
  });

  const activityData = createMockActivityData({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 0 },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Failed,
  });
});

test('it returns a completed checkpoint that folds in the completion bonus', async () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 6,
  };

  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
  });

  const enemyData = createMockEnemyData({ life: 1, xp: 10 });

  const activityData = createMockActivityData({
    difficulty: 1,
    enemies: [enemyData],
    failureAction: ActivityFailureAction.Retry,
    id: 'world_node_1',
    type: ActivityType.WorldNode,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupCount: 1, groupSize: 1 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    hash: expect.toBeString(),
    nextSeed: expect.toBeNumber(),
    rewards: { xp: 10 + buildCompletionXP(1) },
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Completed,
  });
});

test('it carries a levelUp when a completion bonus crosses a level threshold', async () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 6,
  };

  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
    xp: 80,
  });

  const enemyData = createMockEnemyData({ life: 1, xp: 0 });

  const activityData = createMockActivityData({
    difficulty: 1,
    enemies: [enemyData],
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupCount: 1, groupSize: 1 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint.type).toBe(ActivityCheckpointType.Completed);
  expect(checkpoint.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getAppState().level).toBe(2);
});

test('it records a levelUp checkpoint when a group clear crosses a level threshold', async () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 6,
  };

  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
    xp: 0,
  });

  const enemyData = createMockEnemyData({ life: 1, xp: 250 });
  const activityData = createMockActivityData({ difficulty: 1, enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupCount: 1, groupSize: 1 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  const groupClearResult = await generator.next(1000);

  const checkpoint = groupClearResult.value;

  expect(checkpoint?.type).toBe(ActivityCheckpointType.Progress);
  expect(checkpoint?.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getAppState().level).toBe(2);
});

test('it keeps xp and a level-up earned on the same tick the avatar dies', async () => {
  const avatarWeapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 9999,
    minDamage: 9999,
    name: 'Test Weapon',
    speed: 1,
  };

  const avatarData = createMockAvatarData({
    life: 5,
    paperdoll: {
      [EquipmentSlot.MainHand]: avatarWeapon,
    },
    xp: 0,
  });

  const enemyData = createMockEnemyData({
    life: 1,
    primaryAttack: {
      maxDamage: 9999,
      minDamage: 9999,
      speed: 2,
    },
    xp: 250,
  });

  const activityData = createMockActivityData({ difficulty: 1, enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupCount: 1, groupSize: 1 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = simulateActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  // the group's only enemy and the avatar both die within this same combat tick
  const groupClearResult = await generator.next(1000);

  const progressCheckpoint = groupClearResult.value;

  expect(avatar.isAlive).toBeFalse();
  expect(progressCheckpoint?.type).toBe(ActivityCheckpointType.Progress);
  expect(progressCheckpoint?.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getAppState().level).toBe(2);

  const failedResult = await generator.next(1000);

  invariant(failedResult.done === true, 'the activity must resolve to a failed checkpoint');

  const failedCheckpoint = failedResult.value;

  expect(failedCheckpoint.type).toBe(ActivityCheckpointType.Failed);

  // the failure penalty applies on top of the running total, never dropping xp below the
  // threshold of the level earned this same tick
  expect(failedCheckpoint.rewards.xp).toBeGreaterThan(0);
  expect(failedCheckpoint.rewards.xp).toBeLessThan(250);
  expect(levelForXP(avatar.xp + failedCheckpoint.rewards.xp)).toBe(2);
});

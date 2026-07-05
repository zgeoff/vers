import { expect, test } from 'vitest';
import { createAvatar } from '../entities/create-avatar';
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

  const { value: firstCheckpoint } = await generator.next();

  expect(firstCheckpoint).toStrictEqual({
    hash: expect.any(String),
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

  const enemyData = createMockEnemyData({ life: 1 });

  const activityData = createMockActivityData({
    enemies: [enemyData],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    type: ActivityType.AetherNode,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx, { groupSize: 5 });
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const generator = simulateActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  const { value: secondCheckpoint } = await generator.next(1000);
  const { value: thirdCheckpoint } = await generator.next(1000);

  await generator.next(1000);

  expect(secondCheckpoint).toStrictEqual({
    hash: expect.any(String),
    nextSeed: expect.any(Number),
    time: expect.any(Number),
    type: ActivityCheckpointType.Progress,
  });

  expect(thirdCheckpoint).toStrictEqual({
    hash: expect.any(String),
    nextSeed: expect.any(Number),
    time: expect.any(Number),
    type: ActivityCheckpointType.Progress,
  });
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

  while (!result.done) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    hash: expect.any(String),
    nextSeed: expect.any(Number),
    time: expect.any(Number),
    type: ActivityCheckpointType.Failed,
  });
});

test('it returns a completed checkpoint when all enemies are defeated', async () => {
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

  const enemyData = createMockEnemyData({ life: 1 });

  const activityData = createMockActivityData({
    enemies: [enemyData],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    type: ActivityType.AetherNode,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const generator = simulateActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (!result.done) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    hash: expect.any(String),
    nextSeed: expect.any(Number),
    time: expect.any(Number),
    type: ActivityCheckpointType.Completed,
  });
});

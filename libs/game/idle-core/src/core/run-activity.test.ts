import { expect, test } from 'bun:test';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { createAvatar } from '../entities/create-avatar';
import { buildCompletionXP, buildLevelFromXP } from '../progression';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/factories/create-mock-simulation-context';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  ActivityType,
  EquipmentSlot,
} from '../types';
import type { EquipmentWeapon } from '../types';
import { buildSimulationInput } from './build-simulation-input';
import { createActivity } from './create-activity';
import { createCombatExecutor } from './create-combat-executor';
import { runActivity } from './run-activity';

test('it immediately generates a started checkpoint', async () => {
  const avatarData = createMockAvatarData();
  const enemyData = createMockEnemyData();

  const activityData = createMockActivityInput({
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  const firstResult = await generator.next();

  const firstCheckpoint = firstResult.value;

  expect(firstCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: expect.toBeString(),
    time: 0,
    type: ActivityCheckpointType.Started,
  });
});

test('it clears a wave from a difficulty-0 source node without crashing on the reward-slot tier', async () => {
  const built = buildSimulationInput({
    avatarID: 'avatar_1',
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 0 },
    id: 'act_1',
    seed: 'ee'.repeat(16),
  });

  const [firstEnemy] = built.activity.encounter.waves[0] ?? [];

  invariant(firstEnemy, 'the derived encounter must open with a populated wave');

  const activityData = {
    ...built.activity,
    encounter: { waves: [[{ ...firstEnemy, life: 1 }]] },
  };

  const avatarData = {
    ...built.avatar,
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 9999,
        minDamage: 9999,
        name: 'Test Weapon',
        speed: 6,
      },
    },
  };

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  // clearing the activity's only wave computes its reward-slot tier from the floored difficulty —
  // the crash site an unfloored difficulty-0 activity throws its invariant from
  const waveClearResult = await generator.next(1000);

  invariant(waveClearResult.value, 'the wave clear must produce a checkpoint');

  expect(waveClearResult.value.rewardSlots).toStrictEqual([
    { context: { nodeTier: 1 }, ordinal: 0 },
  ]);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  expect(result.value.type).toBe(ActivityCheckpointType.Completed);
});

test('it generates wave killed checkpoints', async () => {
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
  const wave = Array.from({ length: 5 }, () => enemyData);

  const activityData = createMockActivityInput({
    encounter: { waves: [wave, wave, wave, wave] },
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    type: ActivityType.WorldMapEncounter,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  const secondResult = await generator.next(1000);

  const secondCheckpoint = secondResult.value;

  const thirdResult = await generator.next(1000);

  const thirdCheckpoint = thirdResult.value;

  await generator.next(1000);

  const expectedRewardSlots = Array.from({ length: 5 }, (_unused, ordinal) => ({
    context: { nodeTier: 1 },
    ordinal,
  }));

  expect(secondCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 5 },
    rewardSlots: expectedRewardSlots,
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });

  expect(thirdCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 5 },
    rewardSlots: expectedRewardSlots,
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });
});

test('it accrues rewards across multiple cleared waves', async () => {
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
  const wave = Array.from({ length: 5 }, () => enemyData);

  const activityData = createMockActivityInput({
    encounter: { waves: [wave, wave] },
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    type: ActivityType.WorldMapEncounter,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  // clear the first wave
  await generator.next(1000);

  expect(activity.rewards).toStrictEqual({ xp: 50 });

  // clear the second wave
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

  const activityData = createMockActivityInput({ encounter: { waves: [[enemyData]] } });
  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    rewardSlots: [],
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

  const activityData = createMockActivityInput({
    difficulty: 1,
    encounter: { waves: [[enemyData]] },
    failureAction: ActivityFailureAction.Retry,
    id: 'world_map_encounter_1',
    type: ActivityType.WorldMapEncounter,
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 10 + buildCompletionXP(1) },
    rewardSlots: [],
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

  const activityData = createMockActivityInput({
    difficulty: 1,
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  let result = await generator.next(1000);

  while (result.done !== true) {
    result = await generator.next(1000);
  }

  const checkpoint = result.value;

  expect(checkpoint.type).toBe(ActivityCheckpointType.Completed);
  expect(checkpoint.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getSnapshot().level).toBe(2);
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

  const activityData = createMockActivityInput({
    difficulty: 1,
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  const waveClearResult = await generator.next(1000);

  const checkpoint = waveClearResult.value;

  expect(checkpoint?.type).toBe(ActivityCheckpointType.Progress);
  expect(checkpoint?.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getSnapshot().level).toBe(2);
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

  const activityData = createMockActivityInput({
    difficulty: 1,
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);
  const generator = runActivity(executor, activity, avatar, ctx);

  // skip the started checkpoint
  await generator.next(1000);

  // the wave's only enemy and the avatar both die within this same combat tick
  const waveClearResult = await generator.next(1000);

  const progressCheckpoint = waveClearResult.value;

  expect(avatar.isAlive).toBeFalse();
  expect(progressCheckpoint?.type).toBe(ActivityCheckpointType.Progress);
  expect(progressCheckpoint?.levelUp).toStrictEqual({ from: 1, to: 2 });
  expect(avatar.getSnapshot().level).toBe(2);

  const failedResult = await generator.next(1000);

  invariant(failedResult.done === true, 'the activity must resolve to a failed checkpoint');

  const failedCheckpoint = failedResult.value;

  expect(failedCheckpoint.type).toBe(ActivityCheckpointType.Failed);

  // the failure penalty applies on top of the running total, never dropping xp below the
  // threshold of the level earned this same tick
  expect(failedCheckpoint.rewards.xp).toBeGreaterThan(0);
  expect(failedCheckpoint.rewards.xp).toBeLessThan(250);
  expect(buildLevelFromXP(avatar.xp + failedCheckpoint.rewards.xp)).toBe(2);
});

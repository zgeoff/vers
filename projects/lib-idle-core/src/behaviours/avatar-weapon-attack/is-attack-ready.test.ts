import { expect, test } from 'bun:test';
import { createActivity } from '../../core/create-activity';
import { createCombatExecutor } from '../../core/create-combat-executor';
import { createAvatar } from '../../entities/create-avatar';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { EquipmentSlot } from '../../types';
import { isAttackReady } from './is-attack-ready';

test('it returns true when elapsed time is equal or greater than the next attack time', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Test Weapon',
        speed: 1, // 1000ms interval
      },
    },
  });

  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const state = { lastAttackTime: 0 };

  executor.run(1000);

  expect(isAttackReady(avatar, state, executor)).toBeTrue();

  executor.run(1);

  expect(isAttackReady(avatar, state, executor)).toBeTrue();
});

test('it returns false when elapsed time is less than the next attack time', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Test Weapon',
        speed: 1, // 1000ms interval
      },
    },
  });

  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const state = { lastAttackTime: 0 };

  executor.run(999);

  expect(isAttackReady(avatar, state, executor)).toBeFalse();
});

test('it uses the last attacked time to calculate the next attack time', () => {
  const avatarData = createMockAvatarData({
    paperdoll: {
      [EquipmentSlot.MainHand]: {
        id: 'test-weapon',
        maxDamage: 10,
        minDamage: 5,
        name: 'Test Weapon',
        speed: 1, // 1000ms interval
      },
    },
  });

  const ctx = createMockSimulationContext();
  const activityData = createMockActivityData();
  const activity = createActivity(activityData, ctx);
  const avatar = createAvatar(avatarData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const state = { lastAttackTime: 999 };

  expect(isAttackReady(avatar, state, executor)).toBeFalse();

  executor.run(1000);

  expect(isAttackReady(avatar, state, executor)).toBeFalse();

  executor.run(1000);

  expect(isAttackReady(avatar, state, executor)).toBeTrue();
});

test('it returns false when the avatar is dead', () => {
  const avatarData = createMockAvatarData({ life: 1 });

  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1, // 1000ms interval
    },
  });

  const activityData = createMockActivityData({ enemies: [enemyData] });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const executor = createCombatExecutor(activity, avatar, ctx);

  const state = { lastAttackTime: 0 };

  avatar.receiveDamage(100);

  expect(isAttackReady(avatar, state, executor)).toBeFalse();
});

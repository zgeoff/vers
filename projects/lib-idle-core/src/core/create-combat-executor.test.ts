import { expect, test } from 'bun:test';
import { createAvatar } from '../entities/create-avatar';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import type { EquipmentWeapon } from '../types';
import { EquipmentSlot } from '../types';
import { createActivity } from './create-activity';
import { createCombatExecutor } from './create-combat-executor';

test('it processes events', () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 100,
    minDamage: 100,
    name: 'Test Weapon',
    speed: 1,
  };

  const avatarData = createMockAvatarData({
    life: 100,
    paperdoll: {
      [EquipmentSlot.MainHand]: weapon,
    },
  });

  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 40,
      minDamage: 40,
      speed: 1,
    },
  });

  const activityData = createMockActivityData({
    enemies: [enemyData],
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);

  const activity = createActivity(activityData, ctx, {
    groupCount: 1,
    groupSize: 2,
  });

  const enemyGroup = activity.currentEnemyGroup;

  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  // run the combat for 1s so that all entities should attack once
  combatExecutor.run(1000);

  // in this contrived example, the avatar should kill one enemy and be left with one enemy
  // and have received one enemy worth of damage
  expect(enemyGroup?.remaining).toBe(1);
  expect(avatar.life).toBe(60);
});

test('it returns the expected combat executor state for a client app', () => {
  const ctx = createMockSimulationContext();
  const activity = createActivity(createMockActivityData(), ctx);
  const avatar = createAvatar(createMockAvatarData(), ctx);
  const combatExecutor = createCombatExecutor(activity, avatar, ctx);

  const state = combatExecutor.getAppState();

  expect(state).toStrictEqual({
    elapsed: 0,
  });
});

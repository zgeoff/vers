import { expect, test } from 'vitest';
import { createAvatar } from '../entities/create-avatar';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/create-mock-simulation-context';
import type { AvatarAttackEvent, EquipmentWeapon } from '../types';
import { CombatEventType, EquipmentSlot } from '../types';
import { createActivity } from './create-activity';
import { handleAvatarAttack } from './handle-avatar-attack';

test('it applies damage to the first living enemy', () => {
  const weapon: EquipmentWeapon = {
    id: 'test-weapon',
    maxDamage: 10,
    minDamage: 10,
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
  const firstEnemy = enemyGroup?.nextLivingEnemy;

  // kill the first enemy
  firstEnemy?.receiveDamage(100);

  const event: AvatarAttackEvent = {
    id: 'event-1',
    source: avatar.id,
    time: 100,
    type: CombatEventType.AvatarAttack,
  };

  handleAvatarAttack(event, avatar, activity);

  // verify second enemy's life
  expect(enemyGroup?.nextLivingEnemy?.life).toBe(90);
});

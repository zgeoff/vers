import { expect, test } from 'bun:test';
import { createAvatar } from '../entities/create-avatar';
import { createMockActivityInput } from '../test-utils/create-mock-activity-input';
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

  const activityData = createMockActivityInput({
    enemies: [enemyData],
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);

  const activity = createActivity(activityData, ctx, {
    waveCount: 1,
    waveSize: 2,
  });

  const wave = activity.currentWave;
  const firstEnemy = wave?.nextLivingEnemy;

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
  expect(wave?.nextLivingEnemy?.life).toBe(90);
});

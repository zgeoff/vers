import { expect, test } from 'bun:test';
import { createAvatar } from '../entities/create-avatar';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../test-utils/factories/create-mock-simulation-context';
import type { EnemyAttackEvent } from '../types';
import { CombatEventType } from '../types';
import { createActivity } from './create-activity';
import { handleEnemyAttack } from './handle-enemy-attack';

test('it applies damage from the enemy to the avatar', () => {
  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speedPerMille: 1000,
    },
  });

  const avatarData = createMockAvatarData({ life: 100 });

  const activityData = createMockActivityInput({
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const enemy = activity.currentWave!.nextLivingEnemy!;

  const event: EnemyAttackEvent = {
    source: enemy.id,
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  handleEnemyAttack(event, avatar, activity);

  expect(avatar.life).toBe(90);
});

test('it does nothing if the enemy is dead', () => {
  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speedPerMille: 1000,
    },
  });

  const avatarData = createMockAvatarData({ life: 100 });

  const activityData = createMockActivityInput({
    encounter: { waves: [[enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const enemy = activity.currentWave!.nextLivingEnemy!;

  enemy.receiveDamage(100);

  const event: EnemyAttackEvent = {
    source: enemy.id,
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  handleEnemyAttack(event, avatar, activity);

  expect(avatar.life).toBe(100);
});

test('it correctly resolves the correct event source', () => {
  const enemyData = createMockEnemyData({
    life: 100,
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speedPerMille: 1000,
    },
  });

  const avatarData = createMockAvatarData({ life: 100 });

  const activityData = createMockActivityInput({
    // with a single enemy, a wrong event-source lookup would still find the right attacker
    encounter: { waves: [[enemyData, enemyData]] },
  });

  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const activity = createActivity(activityData, ctx);
  const firstEnemy = activity.currentWave!.nextLivingEnemy!;

  const event: EnemyAttackEvent = {
    source: firstEnemy.id,
    time: 100,
    type: CombatEventType.EnemyAttack,
  };

  firstEnemy.receiveDamage(100);

  handleEnemyAttack(event, avatar, activity);

  expect(avatar.life).toBe(100);
});

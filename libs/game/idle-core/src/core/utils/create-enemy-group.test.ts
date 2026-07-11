import { expect, test } from 'bun:test';
import { createMockActivityData } from '../../test-utils/create-mock-activity-data';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { createEnemyGroup } from './create-enemy-group';

test('it creates an enemy group with the given number of enemies', () => {
  const activity = createMockActivityData();
  const ctx = createMockSimulationContext();
  const enemyGroup = createEnemyGroup(activity, ctx, 2);

  expect(enemyGroup.id).toBeString();
  expect(enemyGroup.enemies).toHaveLength(2);
  expect(enemyGroup.remaining).toBe(2);
});

test('it returns the correct remaining count as enemies are killed', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const activity = createMockActivityData({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const enemyGroup = createEnemyGroup(activity, ctx, 2);

  enemyGroup.nextLivingEnemy?.receiveDamage(100);
  expect(enemyGroup.remaining).toBe(1);
});

test('it returns no living enemy when all enemies are dead', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const activity = createMockActivityData({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const enemyGroup = createEnemyGroup(activity, ctx, 2);

  enemyGroup.nextLivingEnemy?.receiveDamage(100);
  enemyGroup.nextLivingEnemy?.receiveDamage(100);
  expect(enemyGroup.remaining).toBe(0);
  expect(enemyGroup.nextLivingEnemy).toBeNull();
});

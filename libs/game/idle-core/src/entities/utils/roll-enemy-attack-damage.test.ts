import { expect, test } from 'bun:test';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { createEnemy } from '../create-enemy';
import { rollEnemyAttackDamage } from './roll-enemy-attack-damage';

test('it calculates the damage for an enemy attack', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 10,
      speed: 1,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const damage = rollEnemyAttackDamage(enemy, ctx);

  expect(damage).toBe(10);
});

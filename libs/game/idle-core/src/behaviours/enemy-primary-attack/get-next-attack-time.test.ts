import { expect, test } from 'bun:test';
import { createEnemy } from '../../entities/create-enemy';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { getNextAttackTime } from './get-next-attack-time';

test('it calculates the next attack time', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy('test-enemy', enemyData, ctx);
  const state = { lastAttackTime: 1000 };
  const nextAttackTime = getNextAttackTime(enemy, state);

  expect(nextAttackTime).toBe(2000); // 1000 + 1000
});

import { expect, test } from 'bun:test';
import { createEnemy } from '../../entities/create-enemy';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { getAttackIntervalMS } from './get-attack-interval-ms';

test('it calculates the primary attack interval', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 0.55,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy(enemyData, ctx);
  const interval = getAttackIntervalMS(enemy);

  expect(interval).toBe(1818); // 1000ms / 0.55 = 1818ms
});

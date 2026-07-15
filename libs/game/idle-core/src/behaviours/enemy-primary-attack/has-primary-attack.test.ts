import { expect, test } from 'bun:test';
import { createEnemy } from '../../entities/create-enemy';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { hasPrimaryAttack } from './has-primary-attack';

test('it returns true when enemy has a primary attack', () => {
  const enemyData = createMockEnemyData({
    primaryAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
  });

  const ctx = createMockSimulationContext();
  const enemy = createEnemy(enemyData, ctx);
  const result = hasPrimaryAttack(enemy);

  expect(result).toBeTrue();
});

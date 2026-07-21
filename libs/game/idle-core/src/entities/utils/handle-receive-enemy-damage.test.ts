import { expect, test } from 'bun:test';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { EntityStatus } from '../../types';
import { createEnemy } from '../create-enemy';
import { handleReceiveEnemyDamage } from './handle-receive-enemy-damage';

test('it reduces the life of the entity by the amount of damage received', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData({ life: 100 });
  const enemy = createEnemy('test-enemy', data, ctx);

  handleReceiveEnemyDamage(10, enemy);

  expect(enemy.life).toBe(90);
});

test('it sets the status to dead if the life is 0 or less', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData({ life: 100 });
  const enemy = createEnemy('test-enemy', data, ctx);

  handleReceiveEnemyDamage(100, enemy);

  expect(enemy.status).toBe(EntityStatus.Dead);
});

test('it does not reduce the life below 0', () => {
  const ctx = createMockSimulationContext();
  const data = createMockEnemyData({ life: 10 });
  const enemy = createEnemy('test-enemy', data, ctx);

  handleReceiveEnemyDamage(100, enemy);

  expect(enemy.life).toBe(0);
});

import { expect, test } from 'bun:test';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { createWave } from './create-wave';

test('it creates a wave with the given enemy data', () => {
  const ctx = createMockSimulationContext();
  const wave = createWave(0, [createMockEnemyData(), createMockEnemyData()], ctx);

  expect(wave.enemies).toHaveLength(2);
  expect(wave.remaining).toBe(2);
});

test('it derives its id from its wave index', () => {
  const ctx = createMockSimulationContext();
  const wave = createWave(3, [createMockEnemyData()], ctx);

  expect(wave.id).toBe('wave-3');
});

test('it returns the correct remaining count as enemies are killed', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const ctx = createMockSimulationContext();
  const wave = createWave(0, [enemyData, enemyData], ctx);

  wave.nextLivingEnemy?.receiveDamage(100);
  expect(wave.remaining).toBe(1);
});

test('it returns no living enemy when all enemies are dead', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const ctx = createMockSimulationContext();
  const wave = createWave(0, [enemyData, enemyData], ctx);

  wave.nextLivingEnemy?.receiveDamage(100);
  wave.nextLivingEnemy?.receiveDamage(100);
  expect(wave.remaining).toBe(0);
  expect(wave.nextLivingEnemy).toBeNull();
});

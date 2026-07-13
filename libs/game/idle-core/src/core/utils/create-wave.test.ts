import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { createWave } from './create-wave';

test('it creates a wave with the given number of enemies', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  expect(wave.id).toBeString();
  expect(wave.enemies).toHaveLength(2);
  expect(wave.remaining).toBe(2);
});

test('it returns the correct remaining count as enemies are killed', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  wave.nextLivingEnemy?.receiveDamage(100);
  expect(wave.remaining).toBe(1);
});

test('it returns no living enemy when all enemies are dead', () => {
  const enemyData = createMockEnemyData({
    life: 100,
  });

  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  wave.nextLivingEnemy?.receiveDamage(100);
  wave.nextLivingEnemy?.receiveDamage(100);
  expect(wave.remaining).toBe(0);
  expect(wave.nextLivingEnemy).toBeNull();
});

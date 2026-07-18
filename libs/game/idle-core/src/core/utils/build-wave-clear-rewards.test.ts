import { expect, test } from 'bun:test';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { buildWaveClearRewards } from './build-wave-clear-rewards';
import { createWave } from './create-wave';

test('it sums the resolved xp of every enemy in the wave', () => {
  const enemyData = createMockEnemyData({ xp: 10 });
  const ctx = createMockSimulationContext();
  const wave = createWave(0, [enemyData, enemyData, enemyData], ctx);

  expect(buildWaveClearRewards(wave)).toStrictEqual({ xp: 30 });
});

test('it returns zero xp for an empty wave', () => {
  const ctx = createMockSimulationContext();
  const wave = createWave(0, [], ctx);

  expect(buildWaveClearRewards(wave)).toStrictEqual({ xp: 0 });
});

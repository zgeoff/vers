import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { buildWaveClearRewards } from './build-wave-clear-rewards';
import { createWave } from './create-wave';

test('it sums the difficulty-scaled xp of every enemy in the wave', () => {
  const enemyData = createMockEnemyData({ xp: 10 });
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 3);

  expect(buildWaveClearRewards(wave, 1)).toStrictEqual({ xp: 30 });
});

test('it returns zero xp for an empty wave', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 0);

  expect(buildWaveClearRewards(wave, 1)).toStrictEqual({ xp: 0 });
});

test('it scales the summed xp by difficulty', () => {
  const enemyData = createMockEnemyData({ xp: 10 });
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  expect(buildWaveClearRewards(wave, 2)).toStrictEqual({ xp: 40 });
});

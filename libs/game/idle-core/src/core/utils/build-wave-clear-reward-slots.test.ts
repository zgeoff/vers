import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { buildWaveClearRewardSlots } from './build-wave-clear-reward-slots';
import { createWave } from './create-wave';

test('it yields one reward slot per enemy in the wave', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 3);

  expect(buildWaveClearRewardSlots(wave, 2)).toStrictEqual([
    { context: { nodeTier: 2 }, ordinal: 0 },
    { context: { nodeTier: 2 }, ordinal: 1 },
    { context: { nodeTier: 2 }, ordinal: 2 },
  ]);
});

test('it returns an empty array for an empty wave', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 0);

  expect(buildWaveClearRewardSlots(wave, 1)).toStrictEqual([]);
});

test('it builds the identical slots for the same wave and difficulty', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  expect(buildWaveClearRewardSlots(wave, 3)).toStrictEqual(buildWaveClearRewardSlots(wave, 3));
});

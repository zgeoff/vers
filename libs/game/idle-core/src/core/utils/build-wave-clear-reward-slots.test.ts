import { expect, test } from 'bun:test';
import { createMockActivityInput } from '../../test-utils/factories/create-mock-activity-input';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { buildWaveClearRewardSlots } from './build-wave-clear-reward-slots';
import { createWave } from './create-wave';

test('it yields one reward-slot context per enemy in the wave', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 3);

  expect(buildWaveClearRewardSlots(wave, 2)).toStrictEqual([
    { nodeTier: 2 },
    { nodeTier: 2 },
    { nodeTier: 2 },
  ]);
});

test('it returns an empty array for an empty wave', () => {
  const activity = createMockActivityInput();
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 0);

  expect(buildWaveClearRewardSlots(wave, 1)).toStrictEqual([]);
});

test('it builds the identical contexts for the same wave and difficulty', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 2);

  expect(buildWaveClearRewardSlots(wave, 3)).toStrictEqual(buildWaveClearRewardSlots(wave, 3));
});

test('it rejects a non-positive difficulty', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 1);

  expect(() => buildWaveClearRewardSlots(wave, 0)).toThrowWithMessage(
    Error,
    /nodeTier must be a positive integer/,
  );
});

test('it rejects a fractional difficulty', () => {
  const enemyData = createMockEnemyData();
  const activity = createMockActivityInput({ enemies: [enemyData] });
  const ctx = createMockSimulationContext();
  const wave = createWave(activity, ctx, 1);

  expect(() => buildWaveClearRewardSlots(wave, 1.5)).toThrowWithMessage(
    Error,
    /nodeTier must be a positive integer/,
  );
});

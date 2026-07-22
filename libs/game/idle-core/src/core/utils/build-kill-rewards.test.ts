import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createMockEnemyData } from '../../test-utils/factories/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { buildKillRewards } from './build-kill-rewards';
import { createWave } from './create-wave';

test('it earns nothing while every enemy is still standing', () => {
  const ctx = createMockSimulationContext();
  const enemyData = createMockEnemyData({ life: 30, xp: 10 });
  const wave = createWave(0, [enemyData, enemyData, enemyData], ctx);

  expect(buildKillRewards(wave, 0)).toStrictEqual({ xp: 0 });
});

test('it earns the xp of each fallen enemy', () => {
  const ctx = createMockSimulationContext();
  const enemyData = createMockEnemyData({ life: 30, xp: 10 });
  const wave = createWave(0, [enemyData, enemyData, enemyData], ctx);
  const [fallen] = wave.enemies;

  invariant(fallen !== undefined, 'the wave was built with three enemies');

  fallen.receiveDamage(30);

  expect(buildKillRewards(wave, 0)).toStrictEqual({ xp: 10 });
});

test('it earns only what the credited total has not already covered', () => {
  const ctx = createMockSimulationContext();
  const enemyData = createMockEnemyData({ life: 30, xp: 10 });
  const wave = createWave(0, [enemyData, enemyData, enemyData], ctx);

  for (const enemy of wave.enemies) {
    enemy.receiveDamage(30);
  }

  expect(buildKillRewards(wave, 20)).toStrictEqual({ xp: 10 });
});

test('it earns nothing once the credited total covers the whole wave', () => {
  const ctx = createMockSimulationContext();
  const enemyData = createMockEnemyData({ life: 30, xp: 10 });
  const wave = createWave(0, [enemyData, enemyData, enemyData], ctx);

  for (const enemy of wave.enemies) {
    enemy.receiveDamage(30);
  }

  expect(buildKillRewards(wave, 30)).toStrictEqual({ xp: 0 });
});

test('it earns nothing from an empty wave', () => {
  const ctx = createMockSimulationContext();
  const wave = createWave(0, [], ctx);

  expect(buildKillRewards(wave, 0)).toStrictEqual({ xp: 0 });
});

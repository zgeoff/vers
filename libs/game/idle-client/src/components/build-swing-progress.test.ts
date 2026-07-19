import { expect, test } from 'bun:test';
import { buildSwingProgress } from './build-swing-progress';

test('it fills proportionally between attacks', () => {
  const progress = buildSwingProgress({
    attackSpeed: 1,
    elapsed: 500,
    isAlive: true,
    lastAttackTime: 0,
  });

  expect(progress).toBe(50);
});

test('it reads empty at the moment of the last attack', () => {
  const progress = buildSwingProgress({
    attackSpeed: 1,
    elapsed: 0,
    isAlive: true,
    lastAttackTime: 0,
  });

  expect(progress).toBe(0);
});

test('it caps at full when elapsed overshoots the next attack', () => {
  const progress = buildSwingProgress({
    attackSpeed: 1,
    elapsed: 5000,
    isAlive: true,
    lastAttackTime: 0,
  });

  expect(progress).toBe(100);
});

test('it clamps to empty when elapsed is behind the last attack', () => {
  const progress = buildSwingProgress({
    attackSpeed: 1,
    elapsed: 100,
    isAlive: true,
    lastAttackTime: 200,
  });

  expect(progress).toBe(0);
});

test('it reads empty for a defeated actor', () => {
  const progress = buildSwingProgress({
    attackSpeed: 1,
    elapsed: 900,
    isAlive: false,
    lastAttackTime: 0,
  });

  expect(progress).toBe(0);
});

test('it reads empty for a zero attack speed rather than dividing by zero', () => {
  const progress = buildSwingProgress({
    attackSpeed: 0,
    elapsed: 900,
    isAlive: true,
    lastAttackTime: 0,
  });

  expect(progress).toBe(0);
});

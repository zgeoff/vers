import { expect, test } from 'bun:test';
import { buildLifeFromLevel } from './build-life-from-level';

test('it returns the base life at level one', () => {
  expect(buildLifeFromLevel(1)).toBe(200);
});

test('it grows life by a fixed amount per level', () => {
  const perLevel = buildLifeFromLevel(2) - buildLifeFromLevel(1);

  for (let level = 2; level <= 50; level++) {
    expect(buildLifeFromLevel(level) - buildLifeFromLevel(level - 1)).toBe(perLevel);
  }
});

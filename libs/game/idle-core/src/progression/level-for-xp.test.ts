import { expect, test } from 'bun:test';
import { levelForXP } from './level-for-xp';
import { xpThreshold } from './xp-threshold';

test('it returns level one for zero xp', () => {
  expect(levelForXP(0)).toBe(1);
});

test('it inverts xpThreshold across a range of levels', () => {
  for (let level = 1; level <= 50; level++) {
    expect(levelForXP(xpThreshold(level))).toBe(level);
  }
});

test('it is monotonic as xp grows', () => {
  let previousLevel = levelForXP(0);

  for (let xp = 0; xp <= 100_000; xp += 137) {
    const level = levelForXP(xp);

    expect(level).toBeGreaterThanOrEqual(previousLevel);

    previousLevel = level;
  }
});

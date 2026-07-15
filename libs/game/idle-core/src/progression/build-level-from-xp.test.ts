import { expect, test } from 'bun:test';
import { buildLevelFromXP } from './build-level-from-xp';
import { buildXPThreshold } from './build-xp-threshold';

test('it returns level one for zero xp', () => {
  expect(buildLevelFromXP(0)).toBe(1);
});

test('it inverts buildXPThreshold across a range of levels', () => {
  for (let level = 1; level <= 50; level++) {
    expect(buildLevelFromXP(buildXPThreshold(level))).toBe(level);
  }
});

test('it is monotonic as xp grows', () => {
  let previousLevel = buildLevelFromXP(0);

  for (let xp = 0; xp <= 100_000; xp += 137) {
    const level = buildLevelFromXP(xp);

    expect(level).toBeGreaterThanOrEqual(previousLevel);

    previousLevel = level;
  }
});

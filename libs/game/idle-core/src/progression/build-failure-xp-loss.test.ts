import { expect, test } from 'bun:test';
import { buildFailureXPLoss } from './build-failure-xp-loss';
import { levelForXP } from './level-for-xp';
import { xpThreshold } from './xp-threshold';

test('it never returns a negative loss', () => {
  for (let xp = 0; xp <= 10_000; xp += 173) {
    expect(buildFailureXPLoss(xp)).toBeGreaterThanOrEqual(0);
  }
});

test('it never drops xp below the current level threshold', () => {
  for (let xp = 0; xp <= 10_000; xp += 173) {
    const floor = xpThreshold(levelForXP(xp));

    expect(xp - buildFailureXPLoss(xp)).toBeGreaterThanOrEqual(floor);
  }
});

test('it returns zero loss exactly at a level threshold', () => {
  const floor = xpThreshold(5);

  expect(buildFailureXPLoss(floor)).toBe(0);
});

import { expect, test } from 'bun:test';
import { buildFailureXPLoss } from './build-failure-xp-loss';
import { buildLevelFromXP } from './build-level-from-xp';
import { buildXPThreshold } from './build-xp-threshold';

test('it never returns a negative loss', () => {
  const runningXPs = Array.from({ length: 58 }, (_, index) => index * 173);

  expect(runningXPs.map((xp) => buildFailureXPLoss(xp))).toSatisfyAll((loss: number) => loss >= 0);
});

test('it never drops xp below the current level threshold', () => {
  const runningXPs = Array.from({ length: 58 }, (_, index) => index * 173);

  expect(runningXPs).toSatisfyAll(
    (xp: number) => xp - buildFailureXPLoss(xp) >= buildXPThreshold(buildLevelFromXP(xp)),
  );
});

test('it returns zero loss exactly at a level threshold', () => {
  const floor = buildXPThreshold(5);

  expect(buildFailureXPLoss(floor)).toBe(0);
});

test.each([
  [4, 0],
  [5, 1],
  [14, 1],
  [15, 2],
  [25, 3],
])('it loses a tenth of %d xp into the level, rounded half up, as %d', (progress, expected) => {
  const floor = buildXPThreshold(5);

  expect(buildFailureXPLoss(floor + progress)).toBe(expected);
});

import { expect, test } from 'bun:test';
import { toAttacksPerSecond } from './to-attacks-per-second';
import { toSpeedPerMille } from './to-speed-per-mille';

test.each([
  [500, 0.5],
  [700, 0.7],
  [800, 0.8],
  [900, 0.9],
])('it converts %d per mille to exactly %d attacks per second', (speedPerMille, expected) => {
  expect(toAttacksPerSecond(speedPerMille)).toBe(expected);
});

test.each([1, 500, 700, 800, 900, 1000, 1001, 1429, 123_457])(
  'it returns %d per mille unchanged after a round trip through attacks per second',
  (speedPerMille) => {
    expect(toSpeedPerMille(toAttacksPerSecond(speedPerMille))).toBe(speedPerMille);
  },
);

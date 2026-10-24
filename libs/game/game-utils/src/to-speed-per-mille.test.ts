import { expect, test } from 'bun:test';
import { toSpeedPerMille } from './to-speed-per-mille';

test.each([
  [0.5, 500],
  [0.7, 700],
  [0.8, 800],
  [0.9, 900],
])('it converts %d attacks per second to exactly %d per mille', (attacksPerSecond, expected) => {
  expect(toSpeedPerMille(attacksPerSecond)).toBe(expected);
});

test('it rounds a product that binary floating point lands just off the integer', () => {
  expect(toSpeedPerMille(1.001)).toBe(1001);
});

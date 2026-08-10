import { expect, test } from 'bun:test';
import { canEncodeMortonKey } from './can-encode-morton-key';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from './consts';

test('it accepts a coordinate near the origin', () => {
  expect(canEncodeMortonKey([-3, 5])).toBe(true);
});

test('it accepts the extreme coordinate of each axis bound', () => {
  expect(canEncodeMortonKey([WORLD_COORD_MAX, WORLD_COORD_MIN])).toBe(true);
});

test('it rejects a coordinate one step past the upper bound', () => {
  expect(canEncodeMortonKey([WORLD_COORD_MAX + 1, 0])).toBe(false);
});

test('it rejects a coordinate one step past the lower bound', () => {
  expect(canEncodeMortonKey([0, WORLD_COORD_MIN - 1])).toBe(false);
});

test('it rejects a fractional axis', () => {
  expect(canEncodeMortonKey([1.5, 0])).toBe(false);
});

test('it rejects a non-finite axis', () => {
  expect(canEncodeMortonKey([0, Number.POSITIVE_INFINITY])).toBe(false);
});

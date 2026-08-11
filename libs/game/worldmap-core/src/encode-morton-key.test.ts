import { expect, test } from 'bun:test';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from './consts';
import { decodeMortonKey } from './decode-morton-key';
import { encodeMortonKey } from './encode-morton-key';

test('it packs the origin to zero', () => {
  expect(encodeMortonKey([0, 0])).toBe(0);
});

test('it interleaves a positive x axis into the even bit positions', () => {
  expect(encodeMortonKey([1, 0])).toBe(4);
});

test('it interleaves a positive y axis into the odd bit positions', () => {
  expect(encodeMortonKey([0, 1])).toBe(8);
});

test('it zigzag-encodes a negative x coordinate into the low bit', () => {
  expect(encodeMortonKey([-1, 0])).toBe(1);
});

test('it packs a coordinate carrying both axes', () => {
  expect(encodeMortonKey([1, -1])).toBe(6);
});

test('it packs a coordinate spanning multiple bit positions on both axes', () => {
  expect(encodeMortonKey([-3, 5])).toBe(153);
});

test('it rejects a fractional x coordinate', () => {
  expect(() => encodeMortonKey([1.5, 0])).toThrow('coordinate outside the packable range: 1.5_0');
});

test('it rejects a fractional y coordinate', () => {
  expect(() => encodeMortonKey([0, -2.25])).toThrow(
    'coordinate outside the packable range: 0_-2.25',
  );
});

test('it rejects a coordinate past the upper packable bound', () => {
  expect(() => encodeMortonKey([WORLD_COORD_MAX + 1, 0])).toThrow('outside the packable range');
});

test('it rejects a coordinate past the lower packable bound', () => {
  expect(() => encodeMortonKey([0, WORLD_COORD_MIN - 1])).toThrow('outside the packable range');
});

test('it packs the extreme coordinate of each axis bound', () => {
  expect(decodeMortonKey(encodeMortonKey([WORLD_COORD_MAX, WORLD_COORD_MIN]))).toStrictEqual([
    WORLD_COORD_MAX,
    WORLD_COORD_MIN,
  ]);
});

test('it round-trips through the Morton decoder for a set of coordinates including negative axes', () => {
  const coords: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [12, -7],
    [-12, 7],
    [-40, -40],
    [1000, -999],
  ];

  for (const coord of coords) {
    expect(decodeMortonKey(encodeMortonKey(coord))).toStrictEqual(coord);
  }
});

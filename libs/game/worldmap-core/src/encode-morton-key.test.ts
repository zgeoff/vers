import { expect, test } from 'bun:test';
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

test('it round-trips through decodeMortonKey for a set of coordinates including negative axes', () => {
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

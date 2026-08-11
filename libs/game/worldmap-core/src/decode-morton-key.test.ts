import { expect, test } from 'bun:test';
import { MORTON_AXIS_BITS } from './consts';
import { decodeMortonKey } from './decode-morton-key';

test('it decodes zero to the origin', () => {
  expect(decodeMortonKey(0)).toStrictEqual([0, 0]);
});

test('it decodes the even bit positions back to a positive x axis', () => {
  expect(decodeMortonKey(4)).toStrictEqual([1, 0]);
});

test('it decodes the odd bit positions back to a positive y axis', () => {
  expect(decodeMortonKey(8)).toStrictEqual([0, 1]);
});

test('it decodes the low bit back to a negative x coordinate', () => {
  expect(decodeMortonKey(1)).toStrictEqual([-1, 0]);
});

test('it decodes a key carrying both axes', () => {
  expect(decodeMortonKey(6)).toStrictEqual([1, -1]);
});

test('it decodes a key spanning multiple bit positions on both axes', () => {
  expect(decodeMortonKey(153)).toStrictEqual([-3, 5]);
});

test('it rejects a negative key', () => {
  expect(() => decodeMortonKey(-1)).toThrow('key outside the packed range: -1');
});

test('it rejects a fractional key', () => {
  expect(() => decodeMortonKey(4.5)).toThrow('key outside the packed range: 4.5');
});

test('it rejects a key wider than the two interleaved axes', () => {
  expect(() => decodeMortonKey(2 ** (2 * MORTON_AXIS_BITS))).toThrow('outside the packed range');
});

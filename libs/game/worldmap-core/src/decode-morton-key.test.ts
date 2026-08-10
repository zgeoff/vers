import { expect, test } from 'bun:test';
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

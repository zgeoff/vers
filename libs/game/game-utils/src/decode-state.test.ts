import { expect, test } from 'bun:test';
import { decodeState } from './decode-state';

test('it decodes each 8-character chunk into a signed 32-bit word', () => {
  expect(decodeState('00000001000000027fffffffffffffff')).toStrictEqual([1, 2, 2_147_483_647, -1]);
});

test('it rejects an all-zero state', () => {
  expect(() => decodeState('0'.repeat(32))).toThrow();
});

test('it rejects a state of the wrong length', () => {
  expect(() => decodeState('abcd')).toThrow();
});

test('it rejects a non-hex state', () => {
  expect(() => decodeState('z'.repeat(32))).toThrow();
});

test('it rejects uppercase hex', () => {
  expect(() => decodeState('A'.repeat(32))).toThrow();
});

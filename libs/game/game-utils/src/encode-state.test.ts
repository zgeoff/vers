import { expect, test } from 'bun:test';
import { decodeState } from './decode-state';
import { encodeState } from './encode-state';

test('it encodes each word as an 8-character unsigned hex chunk in order', () => {
  expect(encodeState([1, 2, 2_147_483_647, -1])).toBe('00000001000000027fffffffffffffff');
});

test('it round-trips through the decoder exactly', () => {
  const hex = '0123456789abcdeffedcba9876543210';

  expect(encodeState(decodeState(hex))).toBe(hex);
});

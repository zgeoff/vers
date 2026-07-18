import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildRollStream } from '@vers/roll-crypto';
import { buildSaltStream } from './build-salt-stream';

test('it reproduces the frozen golden draws for a fixed salt', () => {
  const stream = buildSaltStream(hexToBytes('ab'.repeat(32)));
  const draws = Array.from({ length: 4 }, () => stream.rollRange(0, 9999));

  expect(draws).toStrictEqual([3093, 2227, 4223, 9553]);
});

test('it reproduces identical draws when rebuilt from an equal salt', () => {
  const first = buildSaltStream(hexToBytes('ab'.repeat(32)));
  const second = buildSaltStream(hexToBytes('ab'.repeat(32)));

  expect(Array.from({ length: 16 }, () => first.rollRange(0, 9999))).toStrictEqual(
    Array.from({ length: 16 }, () => second.rollRange(0, 9999)),
  );
});

test('it diverges from a position stream fed the same bytes', () => {
  const salt = buildSaltStream(hexToBytes('ab'.repeat(32)));
  const position = buildRollStream(hexToBytes('ab'.repeat(32)), 'vers/roll-stream/position/v1');

  expect(salt.rollRange(0, 9999)).toBe(3093);
  expect(position.rollRange(0, 9999)).toBe(2724);
});

test('it rejects an empty salt', () => {
  expect(() => buildSaltStream(new Uint8Array(0))).toThrowWithMessage(
    Error,
    /salt must not be empty/,
  );
});

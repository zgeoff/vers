import { expect, test } from 'bun:test';
import { toCellCoord } from './to-cell-coord';
import { toNodeID } from './to-node-id';

test('it recovers a coordinate from its id', () => {
  expect(toCellCoord('3_7')).toStrictEqual([3, 7]);
});

test('it recovers negative coordinates', () => {
  expect(toCellCoord('-4_-9')).toStrictEqual([-4, -9]);
});

test('it round-trips every id built by toNodeID', () => {
  for (let cx = -3; cx <= 3; cx++) {
    for (let cy = -3; cy <= 3; cy++) {
      expect(toCellCoord(toNodeID(cx, cy))).toStrictEqual([cx, cy]);
    }
  }
});

test('it throws on a malformed id', () => {
  expect(() => toCellCoord('not-an-id')).toThrow('malformed node id');
});

test('it throws on a fractional coordinate', () => {
  expect(() => toCellCoord('1.5_2')).toThrow('malformed node id');
});

import { expect, test } from 'bun:test';
import { findCellCoord } from './find-cell-coord';
import { toNodeID } from './to-node-id';

test('it recovers a coordinate from a well-formed id', () => {
  expect(findCellCoord('3_7')).toStrictEqual([3, 7]);
});

test('it recovers negative coordinates', () => {
  expect(findCellCoord('-4_-9')).toStrictEqual([-4, -9]);
});

test('it round-trips every id built by toNodeID', () => {
  for (let cx = -3; cx <= 3; cx++) {
    for (let cy = -3; cy <= 3; cy++) {
      expect(findCellCoord(toNodeID(cx, cy))).toStrictEqual([cx, cy]);
    }
  }
});

test('it misses on a non-coordinate string', () => {
  expect(findCellCoord('a9lp75')).toBeUndefined();
});

test('it misses on a fractional coordinate', () => {
  expect(findCellCoord('1.5_2')).toBeUndefined();
});

test('it misses on a partial coordinate', () => {
  expect(findCellCoord('5')).toBeUndefined();
});

test('it misses on a leading-zero spelling', () => {
  expect(findCellCoord('01_02')).toBeUndefined();
  expect(findCellCoord('00_00')).toBeUndefined();
});

test('it misses on a negative-zero coordinate', () => {
  expect(findCellCoord('-0_0')).toBeUndefined();
});

test('it misses on an out-of-safe-range coordinate', () => {
  expect(findCellCoord('900719925474099200_0')).toBeUndefined();
});

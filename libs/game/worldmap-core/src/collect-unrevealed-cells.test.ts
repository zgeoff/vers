import { expect, test } from 'bun:test';
import { collectUnrevealedCells } from './collect-unrevealed-cells';
import { encodeMortonKey } from './encode-morton-key';

test('it collects every viewport cell absent from the revealed set', () => {
  const cells = collectUnrevealedCells([encodeMortonKey([0, 0])], {
    maxCX: 1,
    maxCY: 1,
    minCX: 0,
    minCY: 0,
  });

  expect(cells).toStrictEqual([
    [0, 1],
    [1, 0],
    [1, 1],
  ]);
});

test('it returns every viewport cell when nothing is revealed', () => {
  const cells = collectUnrevealedCells([], { maxCX: 0, maxCY: 1, minCX: 0, minCY: 0 });

  expect(cells).toStrictEqual([
    [0, 0],
    [0, 1],
  ]);
});

test('it returns nothing when the revealed set covers the viewport', () => {
  const cells = collectUnrevealedCells([encodeMortonKey([0, 0]), encodeMortonKey([0, 1])], {
    maxCX: 0,
    maxCY: 1,
    minCX: 0,
    minCY: 0,
  });

  expect(cells).toBeEmpty();
});

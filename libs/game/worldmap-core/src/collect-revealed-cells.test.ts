import { expect, test } from 'bun:test';
import { collectRevealedCells } from './collect-revealed-cells';

test('it emits one source disc, clipped to the viewport, Morton-sorted', () => {
  const cells = collectRevealedCells([{ coord: [0, 0], radius: 1 }], {
    maxCX: 5,
    maxCY: 5,
    minCX: -5,
    minCY: -5,
  });

  // the seven cells of the radius-1 disc around the origin, in ascending Morton order
  expect(cells).toStrictEqual([0, 1, 2, 4, 6, 8, 9]);
});

test('it clips a disc that extends past the viewport edge', () => {
  const cells = collectRevealedCells([{ coord: [0, 0], radius: 1 }], {
    maxCX: 1,
    maxCY: 1,
    minCX: 0,
    minCY: -1,
  });

  // (-1, 0) and (-1, 1) fall outside the viewport and are dropped from the full seven-cell disc
  expect(cells).toStrictEqual([0, 2, 4, 6, 8]);
});

test('it dedupes cells covered by more than one overlapping disc', () => {
  const cells = collectRevealedCells(
    [
      { coord: [0, 0], radius: 1 },
      { coord: [1, 0], radius: 1 },
    ],
    { maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 },
  );

  // the two radius-1 discs share four cells; the union carries each cell once
  expect(cells).toStrictEqual([0, 1, 2, 4, 6, 8, 9, 12, 16, 18]);
});

test('it excludes a source whose disc cannot reach the viewport', () => {
  const cells = collectRevealedCells(
    [
      { coord: [0, 0], radius: 0 },
      { coord: [100, 100], radius: 1 },
    ],
    { maxCX: 5, maxCY: 5, minCX: 0, minCY: 0 },
  );

  expect(cells).toStrictEqual([0]);
});

test('it returns nothing for an empty source list', () => {
  const cells = collectRevealedCells([], { maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 });

  expect(cells).toBeEmpty();
});

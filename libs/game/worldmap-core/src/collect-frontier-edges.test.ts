import { expect, test } from 'bun:test';
import { collectFrontierEdges } from './collect-frontier-edges';
import { WORLD_COORD_MAX } from './consts';
import { encodeMortonKey } from './encode-morton-key';

test('it traces all six sides of a lone revealed cell', () => {
  const edges = collectFrontierEdges([encodeMortonKey([0, 0])], {
    maxCX: 2,
    maxCY: 2,
    minCX: -2,
    minCY: -2,
  });

  expect(edges).toMatchInlineSnapshot(`
    [
      [
        [
          0.8660254037844386,
          -0.5,
        ],
        [
          0.8660254037844386,
          0.5,
        ],
      ],
      [
        [
          0.8660254037844386,
          0.5,
        ],
        [
          0,
          1,
        ],
      ],
      [
        [
          0,
          1,
        ],
        [
          -0.8660254037844386,
          0.5,
        ],
      ],
      [
        [
          -0.8660254037844386,
          0.5,
        ],
        [
          -0.8660254037844386,
          -0.5,
        ],
      ],
      [
        [
          -0.8660254037844386,
          -0.5,
        ],
        [
          0,
          -1,
        ],
      ],
      [
        [
          0,
          -1,
        ],
        [
          0.8660254037844386,
          -0.5,
        ],
      ],
    ]
  `);
});

test('it produces the same frontier for the same input', () => {
  const cells = [encodeMortonKey([0, 0]), encodeMortonKey([1, 0])];
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  expect(collectFrontierEdges(cells, viewport)).toStrictEqual(
    collectFrontierEdges(cells, viewport),
  );
});

test('it omits the side shared by two adjacent revealed cells', () => {
  const edges = collectFrontierEdges([encodeMortonKey([0, 0]), encodeMortonKey([1, 0])], {
    maxCX: 2,
    maxCY: 2,
    minCX: -2,
    minCY: -2,
  });

  expect(edges).toHaveLength(10);
});

test('it skips a revealed cell outside the viewport', () => {
  const edges = collectFrontierEdges([encodeMortonKey([0, 0]), encodeMortonKey([5, 5])], {
    maxCX: 2,
    maxCY: 2,
    minCX: -2,
    minCY: -2,
  });

  expect(edges).toHaveLength(6);
});

test('it reads neighbour membership from revealed cells outside the viewport', () => {
  const edges = collectFrontierEdges([encodeMortonKey([0, 0]), encodeMortonKey([1, 0])], {
    maxCX: 0,
    maxCY: 2,
    minCX: -2,
    minCY: -2,
  });

  expect(edges).toHaveLength(5);
});

test('it treats a neighbour past the packable range as unrevealed', () => {
  const edges = collectFrontierEdges(
    [encodeMortonKey([WORLD_COORD_MAX, 0]), encodeMortonKey([WORLD_COORD_MAX - 1, 0])],
    { maxCX: WORLD_COORD_MAX, maxCY: 2, minCX: WORLD_COORD_MAX - 2, minCY: -2 },
  );

  expect(edges).toHaveLength(10);
});

test('it returns nothing for an empty revealed set', () => {
  const edges = collectFrontierEdges([], { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 });

  expect(edges).toBeEmpty();
});

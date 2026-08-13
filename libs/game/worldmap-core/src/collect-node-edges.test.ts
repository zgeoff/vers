import { expect, test } from 'bun:test';
import { collectNodeEdges } from './collect-node-edges';
import { toCellCoord } from './to-cell-coord';
import { toNodeID } from './to-node-id';

const SEED = 2024;

test('it connects the origin to at least one neighbour', () => {
  expect(collectNodeEdges(SEED, 0, 0).length).toBeGreaterThan(0);
});

test('it is deterministic for a seed and cell', () => {
  expect(collectNodeEdges(SEED, 2, 3)).toStrictEqual(collectNodeEdges(SEED, 2, 3));
});

test('it identifies every edge by its endpoints sorted ascending', () => {
  for (const edge of collectNodeEdges(SEED, 2, 3)) {
    const [low = '', high = ''] = edge.id.split('|');

    expect(low < high).toBe(true);
  }
});

test('it derives the same edge from both endpoints', () => {
  const originID = toNodeID(0, 0);

  for (const edge of collectNodeEdges(SEED, 0, 0)) {
    const otherID = edge.id.split('|').find((endpoint) => endpoint !== originID) ?? originID;
    const [ocx, ocy] = toCellCoord(otherID);
    const mirrored = collectNodeEdges(SEED, ocx, ocy);

    expect(mirrored.some((candidate) => candidate.id === edge.id)).toBe(true);
  }
});

test('it leaves no cell in a patch isolated', () => {
  for (let cx = -3; cx <= 3; cx++) {
    for (let cy = -3; cy <= 3; cy++) {
      expect(collectNodeEdges(SEED, cx, cy).length).toBeGreaterThan(0);
    }
  }
});

const CONNECTIVITY_BOX_SPAN = 40;

test.each([{ seed: 2024 }, { seed: 90_210 }, { seed: 573_294 }])(
  'it leaves no cell isolated across a 40x40 box for seed $seed',
  (data) => {
    for (let cx = 0; cx < CONNECTIVITY_BOX_SPAN; cx++) {
      for (let cy = 0; cy < CONNECTIVITY_BOX_SPAN; cy++) {
        expect(collectNodeEdges(data.seed, cx, cy).length).toBeGreaterThan(0);
      }
    }
  },
);

test.each([{ seed: 2024 }, { seed: 90_210 }, { seed: 573_294 }])(
  'it spans a 40x40 box as a single connected component for seed $seed',
  (data) => {
    // union-find over every edge the box's cells derive; per-cell degree alone would pass on a
    // fragmented graph of disjoint pairs, so the spanning claim needs its own assertion
    const parents = new Map<string, string>();

    const getRoot = (id: string): string => {
      let node = id;
      let parent = parents.get(node);

      while (parent !== undefined && parent !== node) {
        node = parent;
        parent = parents.get(node);
      }

      return node;
    };

    for (let cx = 0; cx < CONNECTIVITY_BOX_SPAN; cx++) {
      for (let cy = 0; cy < CONNECTIVITY_BOX_SPAN; cy++) {
        for (const edge of collectNodeEdges(data.seed, cx, cy)) {
          const [low = '', high = ''] = edge.id.split('|');

          parents.set(getRoot(low), getRoot(high));
        }
      }
    }

    const roots = new Set<string>();

    for (const id of parents.keys()) {
      roots.add(getRoot(id));
    }

    expect(roots.size).toBe(1);
  },
);

test('it collects a stable edge set for the origin', () => {
  const ids = collectNodeEdges(SEED, 0, 0).map((edge) => edge.id);

  expect(ids).toMatchInlineSnapshot(`
    [
      "-1_0|0_0",
      "-1_1|0_0",
      "0_-1|0_0",
      "0_0|0_1",
      "0_0|1_-1",
      "0_0|1_0",
    ]
  `);
});

test('it collects a stable edge set for a cell far from the origin', () => {
  const ids = collectNodeEdges(SEED, 12, -5).map((edge) => edge.id);

  expect(ids).toMatchInlineSnapshot(`
    [
      "11_-4|12_-5",
      "12_-5|12_-6",
      "12_-4|12_-5",
      "12_-5|13_-6",
      "12_-5|13_-5",
    ]
  `);
});

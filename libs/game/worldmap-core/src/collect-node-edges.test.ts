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
      "11_-5|12_-5",
      "11_-4|12_-5",
      "12_-5|12_-6",
      "12_-4|12_-5",
      "12_-5|13_-6",
      "12_-5|13_-5",
    ]
  `);
});

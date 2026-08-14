import { expect, test } from 'bun:test';
import { collectNodeEdges } from './collect-node-edges';
import { findCellCoord } from './find-cell-coord';
import { isEdgeOwner } from './is-edge-owner';
import { toNodeID } from './to-node-id';

const SEED = 2024;

test('it owns an edge for the cell whose node id leads the sorted id', () => {
  const edge = { endPosition: [0, 0] as const, id: '1_2|3_4', startPosition: [0, 0] as const };

  expect(isEdgeOwner(1, 2, edge)).toBe(true);
  expect(isEdgeOwner(3, 4, edge)).toBe(false);
});

test('it assigns every edge in a cell box to exactly one of its two endpoints', () => {
  for (let cx = -3; cx <= 3; cx++) {
    for (let cy = -3; cy <= 3; cy++) {
      for (const edge of collectNodeEdges(SEED, cx, cy)) {
        const [aID = '', bID = ''] = edge.id.split('|');
        const aCoord = findCellCoord(aID);
        const bCoord = findCellCoord(bID);

        expect(aCoord).toBeDefined();
        expect(bCoord).toBeDefined();

        if (aCoord === undefined || bCoord === undefined) {
          continue;
        }

        const aOwns = isEdgeOwner(aCoord[0], aCoord[1], edge);
        const bOwns = isEdgeOwner(bCoord[0], bCoord[1], edge);

        expect(aOwns).toBe(true);
        expect(bOwns).toBe(false);
      }
    }
  }
});

test('it never assigns ownership to a cell that is neither endpoint', () => {
  const [edge] = collectNodeEdges(SEED, 0, 0);

  expect(edge).toBeDefined();

  if (edge === undefined) {
    return;
  }

  expect(isEdgeOwner(99, 99, edge)).toBe(false);
});

test('it agrees with toNodeID(cx, cy) leading the sorted id, not trailing it', () => {
  const edge = {
    endPosition: [0, 0] as const,
    id: `${toNodeID(0, 0)}|${toNodeID(1, 0)}`,
    startPosition: [0, 0] as const,
  };

  expect(isEdgeOwner(0, 0, edge)).toBe(true);
  expect(isEdgeOwner(1, 0, edge)).toBe(false);
});

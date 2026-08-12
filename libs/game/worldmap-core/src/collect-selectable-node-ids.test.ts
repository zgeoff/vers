import { expect, test } from 'bun:test';
import { collectSelectableNodeIDs } from './collect-selectable-node-ids';
import { isNodeSelectable } from './is-node-selectable';
import { toNodeID } from './to-node-id';

const SEED = 2024;
const GRID_RADIUS = 12;

test('it agrees with isNodeSelectable over every node in a grid around the completed set', () => {
  const completed = new Set([toNodeID(0, 0), toNodeID(5, -3)]);

  const selectable = collectSelectableNodeIDs(SEED, completed);

  for (let cx = -GRID_RADIUS; cx <= GRID_RADIUS; cx++) {
    for (let cy = -GRID_RADIUS; cy <= GRID_RADIUS; cy++) {
      const id = toNodeID(cx, cy);

      expect(selectable.has(id)).toBe(isNodeSelectable(SEED, completed, id));
    }
  }
});

test('it returns no id isNodeSelectable refuses, even outside the probed grid', () => {
  const completed = new Set([toNodeID(0, 0), toNodeID(5, -3)]);

  const selectable = collectSelectableNodeIDs(SEED, completed);

  expect([...selectable]).toSatisfyAll((id: string) => isNodeSelectable(SEED, completed, id));
});

test('it makes only the origin selectable with no completed nodes at all', () => {
  expect(collectSelectableNodeIDs(SEED, new Set())).toStrictEqual(new Set([toNodeID(0, 0)]));
});

import { expect, test } from 'bun:test';
import { collectSelectableNodeIDs } from './collect-selectable-node-ids';
import { isNodeSelectable } from './is-node-selectable';
import { toNodeID } from './to-node-id';

test('it agrees with isNodeSelectable over every node in a grid around the completed set', () => {
  const completed = new Set([toNodeID(0, 0), toNodeID(5, -3)]);

  const selectable = collectSelectableNodeIDs(2024, completed);

  for (let cx = -12; cx <= 12; cx++) {
    for (let cy = -12; cy <= 12; cy++) {
      const id = toNodeID(cx, cy);

      expect(selectable.has(id)).toBe(isNodeSelectable(2024, completed, id));
    }
  }
});

test('it returns no id isNodeSelectable refuses, even outside the probed grid', () => {
  const completed = new Set([toNodeID(0, 0), toNodeID(5, -3)]);

  const selectable = collectSelectableNodeIDs(2024, completed);

  expect([...selectable]).toSatisfyAll((id: string) => isNodeSelectable(2024, completed, id));
});

test('it makes only the origin selectable with no completed nodes at all', () => {
  expect(collectSelectableNodeIDs(2024, new Set())).toStrictEqual(new Set([toNodeID(0, 0)]));
});

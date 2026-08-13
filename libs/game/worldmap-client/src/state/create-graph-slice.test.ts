import { expect, test } from 'bun:test';
import { createGraphSlice } from './create-graph-slice';

test('it builds the empty graph state', () => {
  expect(createGraphSlice()).toStrictEqual({
    regionKey: null,
    selectableNodeIDs: new Set(),
    userSeed: null,
    worldGraph: { edges: {}, nodes: {} },
  });
});

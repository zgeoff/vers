import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldGraph } from '@vers/worldmap-core';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setWorldGraph } from './set-world-graph';
import { useWorldGraphStore } from './use-world-graph-store';

test('it updates the world graph in the store', () => {
  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: createMockWorldMapNode({ id: 'node1', position: [0, 0] }) },
  };

  setWorldGraph(graph);

  const hook = renderHook(() => useWorldGraphStore((state) => state));

  expect(hook.result.current).toStrictEqual(graph);
});

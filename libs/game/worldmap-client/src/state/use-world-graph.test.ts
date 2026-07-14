import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldGraph } from '@vers/worldmap-core';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setWorldGraph } from './set-world-graph';
import { useWorldGraph } from './use-world-graph';

test('it returns the current world graph state', () => {
  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: createMockWorldMapNode({ id: 'node1', position: [0, 0] }) },
  };

  setWorldGraph(graph);

  const hook = renderHook(() => useWorldGraph());

  expect(hook.result.current).toStrictEqual(graph);
});

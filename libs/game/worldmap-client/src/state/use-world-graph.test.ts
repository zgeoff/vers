import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setWorldRegion } from './set-world-region';
import { useWorldGraph } from './use-world-graph';

test('it returns the current world graph state', () => {
  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: createMockWorldMapNode({ id: 'node1', position: [0, 0] }) },
  };

  setWorldRegion(201, graph, null);

  const hook = renderHook(() => useWorldGraph());

  expect(hook.result.current).toStrictEqual(graph);
});

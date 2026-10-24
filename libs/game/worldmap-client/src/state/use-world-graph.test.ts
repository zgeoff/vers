import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setWorldRegion } from './set-world-region';
import { useWorldGraph } from './use-world-graph';

test('it returns the current world graph state', () => {
  const graph: WorldGraph = {
    edges: {
      edge1: createMockWorldMapEdge({ endPosition: [0, 0], id: 'edge1', startPosition: [0, 0] }),
    },
    nodes: { node1: createMockWorldMapNode({ id: 'node1', position: [0, 0] }) },
  };

  setWorldRegion({
    regionKey: 'region-a',
    userSeed: 42,
    worldGraph: graph,
    selectedNode: null,
    selectableNodeIDs: new Set(),
    revealSources: [],
  });

  const hook = renderHook(() => useWorldGraph());

  expect(hook.result.current).toStrictEqual(graph);
});

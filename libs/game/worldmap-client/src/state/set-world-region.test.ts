import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setWorldRegion } from './set-world-region';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the world graph and selected node together', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: node },
  };

  setWorldRegion(graph, node);

  const hook = renderHook(() => useWorldmapStore((state) => state.worldGraph));

  expect(hook.result.current).toStrictEqual(graph);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test('it clears the selection when the region has no node to select', () => {
  setWorldRegion({ edges: {}, nodes: {} }, null);

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

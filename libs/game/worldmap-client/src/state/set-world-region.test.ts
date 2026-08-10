import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setWorldRegion } from './set-world-region';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the seed, world graph, and selected node together', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: node },
  };

  setWorldRegion(101, graph, node);

  const hook = renderHook(() => useWorldmapStore((state) => state.worldGraph));

  expect(hook.result.current).toStrictEqual(graph);
  expect(useWorldmapStore.getState().worldSeed).toBe(101);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test('it clears the selection when the region has no node to select', () => {
  setWorldRegion(102, { edges: {}, nodes: {} }, null);

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test("it skips a write for the seed the store already holds, keeping the player's selection", () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion(103, graph, null);

  useWorldmapStore.setState({ selectedNode: node });

  setWorldRegion(103, { edges: {}, nodes: {} }, null);

  expect(useWorldmapStore.getState().worldGraph).toStrictEqual(graph);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
});

import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setWorldRegion } from './set-world-region';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the region key, world graph, and selected node together', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: { edge1: createMockWorldMapEdge({ end: [0, 0], id: 'edge1', start: [0, 0] }) },
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', graph, node);

  const hook = renderHook(() => useWorldmapStore((state) => state.worldGraph));

  expect(hook.result.current).toStrictEqual(graph);
  expect(useWorldmapStore.getState().regionKey).toBe('avatar-a');
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test('it clears the selection when the region has no node to select', () => {
  setWorldRegion('avatar-a', { edges: {}, nodes: {} }, null);

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test("it skips a write for the key the store already holds, keeping the player's selection", () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', graph, null);

  useWorldmapStore.setState({ selectedNode: node });

  setWorldRegion('avatar-a', { edges: {}, nodes: {} }, null);

  expect(useWorldmapStore.getState().worldGraph).toStrictEqual(graph);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
});

test('it resets the selection for a new key even when the graph is identical', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', graph, null);

  useWorldmapStore.setState({ selectedNode: node });

  setWorldRegion('avatar-b', graph, null);

  expect(useWorldmapStore.getState().regionKey).toBe('avatar-b');
  expect(useWorldmapStore.getState().selectedNode).toBeNull();
});

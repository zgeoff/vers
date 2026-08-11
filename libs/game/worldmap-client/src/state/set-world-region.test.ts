import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setSelectedNode } from './set-selected-node';
import { setViewport } from './set-viewport';
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

test("it refreshes the world graph without resetting the player's selection or viewport for the key the store already holds", () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', graph, null);

  const viewport = { maxCX: 8, maxCY: 8, minCX: -8, minCY: -8 };

  setSelectedNode(node);
  setViewport(viewport);

  const nextGraph: WorldGraph = { edges: {}, nodes: {} };

  setWorldRegion('avatar-a', nextGraph, null);

  expect(useWorldmapStore.getState().worldGraph).toStrictEqual(nextGraph);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().viewport).toStrictEqual(viewport);
});

test('it resets the selection and viewport for a new key even when the graph is identical', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', graph, null);
  setSelectedNode(node);
  setViewport({ maxCX: 8, maxCY: 8, minCX: -8, minCY: -8 });
  setWorldRegion('avatar-b', graph, null);

  expect(useWorldmapStore.getState().regionKey).toBe('avatar-b');
  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().viewport).toBeNull();
});

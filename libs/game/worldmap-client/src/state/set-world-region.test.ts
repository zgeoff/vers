import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapEdge } from '../test-utils/factories/create-mock-world-map-edge';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import type { WorldGraph } from '../types';
import { setSelectedNode } from './set-selected-node';
import { setViewport } from './set-viewport';
import { setWorldRegion } from './set-world-region';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the region key, world graph, selectable set, and selected node together', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {
      edge1: createMockWorldMapEdge({ endPosition: [0, 0], id: 'edge1', startPosition: [0, 0] }),
    },
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', 42, graph, node, new Set(['node1']), [{ coord: [0, 0], radius: 2 }]);

  const hook = renderHook(() => useWorldmapStore((state) => state.worldGraph));

  expect(hook.result.current).toStrictEqual(graph);
  expect(useWorldmapStore.getState().regionKey).toBe('avatar-a');
  expect(useWorldmapStore.getState().userSeed).toBe(42);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
  expect(useWorldmapStore.getState().selectableNodeIDs).toStrictEqual(new Set(['node1']));
  expect(useWorldmapStore.getState().revealSources).toStrictEqual([{ coord: [0, 0], radius: 2 }]);
});

test('it clears the selection when the region has no node to select', () => {
  setWorldRegion('avatar-a', 42, { edges: {}, nodes: {} }, null, new Set(), []);

  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

test("it refreshes the world graph and selectable set without resetting the player's selection or viewport for the key the store already holds", () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', 42, graph, null, new Set(['node1']), []);

  const viewport = { maxCX: 8, maxCY: 8, minCX: -8, minCY: -8 };

  setSelectedNode(node);
  setViewport(viewport);

  const nextGraph: WorldGraph = { edges: {}, nodes: {} };

  setWorldRegion('avatar-a', 42, nextGraph, null, new Set(), [{ coord: [1, 1], radius: 2 }]);

  expect(useWorldmapStore.getState().worldGraph).toStrictEqual(nextGraph);
  expect(useWorldmapStore.getState().selectableNodeIDs).toStrictEqual(new Set());
  expect(useWorldmapStore.getState().revealSources).toStrictEqual([{ coord: [1, 1], radius: 2 }]);
  expect(useWorldmapStore.getState().selectedNode).toStrictEqual(node);
  expect(useWorldmapStore.getState().viewport).toStrictEqual(viewport);
});

test('it resets the selection and viewport for a new key even when the graph is identical', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const graph: WorldGraph = {
    edges: {},
    nodes: { node1: node },
  };

  setWorldRegion('avatar-a', 42, graph, null, new Set(), []);
  setSelectedNode(node);
  setViewport({ maxCX: 8, maxCY: 8, minCX: -8, minCY: -8 });
  setWorldRegion('avatar-b', 43, graph, null, new Set(), []);

  expect(useWorldmapStore.getState().regionKey).toBe('avatar-b');
  expect(useWorldmapStore.getState().userSeed).toBe(43);
  expect(useWorldmapStore.getState().selectedNode).toBeNull();
  expect(useWorldmapStore.getState().viewport).toBeNull();
});

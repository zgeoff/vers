import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldMapNode } from '@vers/worldmap-core';
import { Object3D } from 'three';
import { setSelectedNode } from './set-selected-node';
import { useWorldmapStore } from './use-worldmap-store';

test('it updates the selected node in the store', () => {
  const node: WorldMapNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0] as [number, number],
    seed: 12_345,
  };

  const ref = new Object3D();

  setSelectedNode(node, ref);

  const hook = renderHook(() => useWorldmapStore((state) => state.selectedNode));

  expect(hook.result.current).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBe(ref);
});

test('it clears the object reference when a node is selected without one', () => {
  const node: WorldMapNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node2',
    index: 1,
    position: [0, 0] as [number, number],
    seed: 12_345,
  };

  setSelectedNode(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

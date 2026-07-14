import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { Object3D } from 'three';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setSelectedNode } from './set-selected-node';
import { useWorldmapStore } from './use-worldmap-store';

test('it updates the selected node in the store', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const ref = new Object3D();

  setSelectedNode(node, ref);

  const hook = renderHook(() => useWorldmapStore((state) => state.selectedNode));

  expect(hook.result.current).toStrictEqual(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBe(ref);
});

test('it clears the object reference when a node is selected without one', () => {
  const node = createMockWorldMapNode({ id: 'node2', position: [0, 0] });

  setSelectedNode(node);
  expect(useWorldmapStore.getState().selectedObject3D).toBeNull();
});

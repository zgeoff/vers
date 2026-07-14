import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { Object3D } from 'three';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setSelectedNode } from './set-selected-node';
import { useSelectedNodeStore } from './use-selected-node-store';

test('it updates the selected node in the store', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  const ref = new Object3D();

  setSelectedNode(node, ref);

  const hook = renderHook(() => useSelectedNodeStore((state) => state));

  expect(hook.result.current).toStrictEqual({
    node,
    object3D: ref,
  });
});

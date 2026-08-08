import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { Object3D } from 'three';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { getScenePosition } from '../utils/get-scene-position';
import { setSelectedNode } from './set-selected-node';
import { useSelectedNode } from './use-selected-node';

test('it returns the current selected node and object3D', () => {
  const ref = new Object3D();

  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  setSelectedNode(node, ref);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current).toStrictEqual({
    node,
    object3D: ref,
  });
});

test('it derives an object3D positioned at the node when none was provided', () => {
  const node = createMockWorldMapNode({ id: 'node2', position: [3, 5] });

  setSelectedNode(node);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toStrictEqual(node);

  expect(hook.result.current.object3D?.position.toArray()).toStrictEqual([
    ...getScenePosition(node.position),
  ]);
});

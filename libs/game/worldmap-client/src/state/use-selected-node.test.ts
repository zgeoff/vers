import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldMapNode } from '@vers/worldmap-core';
import { Object3D } from 'three';
import { getScenePosition } from '../utils/get-scene-position';
import { setSelectedNode } from './set-selected-node';
import { useSelectedNode } from './use-selected-node';

test('it returns the current selected node and object3D', () => {
  const ref = new Object3D();

  const node: WorldMapNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0],
    seed: 0,
  };

  setSelectedNode(node, ref);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current).toStrictEqual({
    node: {
      connections: [null, null, null, null],
      difficulty: 1,
      id: 'node1',
      index: 0,
      position: [0, 0],
      seed: 0,
    },
    object3D: ref,
  });
});

test('it derives an object3D positioned at the node when none was provided', () => {
  const node: WorldMapNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node2',
    index: 1,
    position: [3, 5],
    seed: 0,
  };

  setSelectedNode(node);

  const hook = renderHook(() => useSelectedNode());

  expect(hook.result.current.node).toStrictEqual(node);

  expect(hook.result.current.object3D?.position.toArray()).toStrictEqual([
    ...getScenePosition(node.position),
  ]);
});

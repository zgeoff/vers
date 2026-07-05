import { renderHook } from '@testing-library/react';
import type { AetherNode } from '@vers/aether-core';
import { Object3D } from 'three';
import { expect, test } from 'vitest';
import { setSelectedNode } from './set-selected-node';
import { useSelectedNode } from './use-selected-node';

test('it returns the current selected node and object3D', () => {
  const ref = new Object3D();

  const node: AetherNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0],
    seed: 0,
  };

  setSelectedNode(node, ref);

  const { result } = renderHook(() => useSelectedNode());

  expect(result.current).toStrictEqual({
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

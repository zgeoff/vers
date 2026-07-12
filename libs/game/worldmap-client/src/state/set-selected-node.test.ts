import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldMapNode } from '@vers/worldmap-core';
import { Object3D } from 'three';
import { setSelectedNode } from './set-selected-node';
import { useSelectedNodeStore } from './use-selected-node-store';

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

  const hook = renderHook(() => useSelectedNodeStore((state) => state));

  expect(hook.result.current).toStrictEqual({
    node,
    object3D: ref,
  });
});

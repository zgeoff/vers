import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { WorldNode } from '@vers/worldmap-core';
import { setHoveredNode } from './set-hovered-node';
import { useHoveredNodeStore } from './use-hovered-node-store';

test('it updates the hovered node in the store', () => {
  const node: WorldNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0] as [number, number],
    seed: 12_345,
  };

  setHoveredNode(node);

  const hook = renderHook(() => useHoveredNodeStore((state) => state));

  expect(hook.result.current).toStrictEqual({
    node,
  });
});

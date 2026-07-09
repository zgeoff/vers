import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { AetherNode } from '@vers/aether-core';
import { setHoveredNode } from './set-hovered-node';
import { useHoveredNode } from './use-hovered-node';

test('it returns the currently hovered node', () => {
  const node: AetherNode = {
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0],
    seed: 0,
  };

  setHoveredNode(node);

  const hook = renderHook(() => useHoveredNode());

  expect(hook.result.current).toStrictEqual({
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0],
    seed: 0,
  });
});

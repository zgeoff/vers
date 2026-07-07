import { renderHook } from '@testing-library/react';
import type { AetherNode } from '@vers/aether-core';
import { expect, test } from 'vitest';
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

  const result = renderHook(() => useHoveredNode()).result;

  expect(result.current).toStrictEqual({
    connections: [null, null, null, null],
    difficulty: 1,
    id: 'node1',
    index: 0,
    position: [0, 0],
    seed: 0,
  });
});

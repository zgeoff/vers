import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setHoveredNode } from './set-hovered-node';
import { useHoveredNodeStore } from './use-hovered-node-store';

test('it updates the hovered node in the store', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  setHoveredNode(node);

  const hook = renderHook(() => useHoveredNodeStore((state) => state));

  expect(hook.result.current).toStrictEqual({
    node,
  });
});

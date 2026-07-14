import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { setHoveredNode } from './set-hovered-node';
import { useHoveredNode } from './use-hovered-node';

test('it returns the currently hovered node', () => {
  const node = createMockWorldMapNode({ id: 'node1', position: [0, 0] });

  setHoveredNode(node);

  const hook = renderHook(() => useHoveredNode());

  expect(hook.result.current).toStrictEqual(node);
});

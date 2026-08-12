import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setSelectableNodeIDs } from './set-selectable-node-ids';
import { useWorldmapStore } from './use-worldmap-store';

test('it replaces the selectable-node set in the store', () => {
  const selectable = new Set(['node1', 'node2']);

  setSelectableNodeIDs(selectable);

  const hook = renderHook(() => useWorldmapStore((state) => state.selectableNodeIDs));

  expect(hook.result.current).toBe(selectable);
});

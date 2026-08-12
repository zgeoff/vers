import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setSelectableNodeIDs } from './set-selectable-node-ids';
import { useSelectableNodeIDs } from './use-selectable-node-ids';

test('it returns the current selectable-node set', () => {
  const selectable = new Set(['node1']);

  setSelectableNodeIDs(selectable);

  const hook = renderHook(() => useSelectableNodeIDs());

  expect(hook.result.current).toBe(selectable);
});

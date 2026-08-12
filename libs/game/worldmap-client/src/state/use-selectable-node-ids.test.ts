import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setCompletedNodeProjections } from './set-completed-node-projections';
import { useSelectableNodeIDs } from './use-selectable-node-ids';

test('it returns the current selectable-node set', () => {
  const selectable = new Set(['node1']);

  setCompletedNodeProjections(selectable, []);

  const hook = renderHook(() => useSelectableNodeIDs());

  expect(hook.result.current).toBe(selectable);
});

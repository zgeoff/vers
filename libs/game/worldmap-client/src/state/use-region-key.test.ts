import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setWorldRegion } from './set-world-region';
import { useRegionKey } from './use-region-key';

test('it returns the current region key', () => {
  setWorldRegion({
    regionKey: 'avatar-1',
    userSeed: 42,
    worldGraph: { edges: {}, nodes: {} },
    selectedNode: null,
    selectableNodeIDs: new Set(),
    revealSources: [],
  });

  const hook = renderHook(() => useRegionKey());

  expect(hook.result.current).toBe('avatar-1');
});

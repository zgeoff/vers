import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setWorldRegion } from './set-world-region';
import { useUserSeed } from './use-user-seed';

test('it returns the current region seed', () => {
  setWorldRegion({
    regionKey: 'avatar-1',
    userSeed: 123,
    worldGraph: { edges: {}, nodes: {} },
    selectedNode: null,
    selectableNodeIDs: new Set(),
    revealSources: [],
  });

  const hook = renderHook(() => useUserSeed());

  expect(hook.result.current).toBe(123);
});

import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setWorldRegion } from './set-world-region';
import { useRegionKey } from './use-region-key';

test('it returns the current region key', () => {
  setWorldRegion('avatar-1', { edges: {}, nodes: {} }, null, new Set());

  const hook = renderHook(() => useRegionKey());

  expect(hook.result.current).toBe('avatar-1');
});

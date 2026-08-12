import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setWorldRegion } from './set-world-region';
import { useUserSeed } from './use-user-seed';

test('it returns the current region seed', () => {
  setWorldRegion('avatar-1', 123, { edges: {}, nodes: {} }, null, new Set(), []);

  const hook = renderHook(() => useUserSeed());

  expect(hook.result.current).toBe(123);
});

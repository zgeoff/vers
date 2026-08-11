import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setViewport } from './set-viewport';
import { useViewport } from './use-viewport';

test('it returns the current viewport state', () => {
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  setViewport(viewport);

  const hook = renderHook(() => useViewport());

  expect(hook.result.current).toStrictEqual(viewport);
});

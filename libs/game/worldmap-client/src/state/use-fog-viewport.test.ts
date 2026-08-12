import { expect, test } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { setViewport } from './set-viewport';
import { useFogViewport } from './use-fog-viewport';

test('it aligns the stored viewport to the chunk grid', () => {
  setViewport({ maxCX: 17, maxCY: 3, minCX: 1, minCY: -3 });

  const hook = renderHook(() => useFogViewport());

  expect(hook.result.current).toStrictEqual({ maxCX: 31, maxCY: 15, minCX: 0, minCY: -16 });
});

test('it keeps the same reference across a pan inside the same chunks', () => {
  setViewport({ maxCX: 17, maxCY: 3, minCX: 1, minCY: -3 });

  const hook = renderHook(() => useFogViewport());
  const first = hook.result.current;

  act(() => {
    setViewport({ maxCX: 18, maxCY: 4, minCX: 2, minCY: -2 });
  });

  expect(hook.result.current).toBe(first);
});

test('it returns null before the camera reports a viewport', () => {
  const hook = renderHook(() => useFogViewport());

  expect(hook.result.current).toBeNull();
});

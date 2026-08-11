import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setViewport } from './set-viewport';
import { useWorldmapStore } from './use-worldmap-store';

test('it sets the viewport in the store', () => {
  const viewport = { maxCX: 2, maxCY: 2, minCX: -2, minCY: -2 };

  setViewport(viewport);

  const hook = renderHook(() => useWorldmapStore((state) => state.viewport));

  expect(hook.result.current).toStrictEqual(viewport);
});

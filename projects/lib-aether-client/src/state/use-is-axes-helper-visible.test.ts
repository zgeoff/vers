import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIsAxesHelperVisible } from './use-is-axes-helper-visible';

test('it returns the current axes helper visibility state', () => {
  const hook = renderHook(() => useIsAxesHelperVisible());

  expect(hook.result.current).toBeFalse();
});

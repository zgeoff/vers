import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { toggleAxesHelper } from './toggle-axes-helper';
import { useIsAxesHelperVisible } from './use-is-axes-helper-visible';

test('it toggles axes helper visibility', () => {
  const { rerender, result } = renderHook(() => useIsAxesHelperVisible());

  expect(result.current).toBeFalse();

  toggleAxesHelper();
  rerender();

  expect(result.current).toBeTrue();

  toggleAxesHelper();
  rerender();

  expect(result.current).toBeFalse();
});

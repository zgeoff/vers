import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { toggleAxesHelper } from './toggle-axes-helper';
import { useIsAxesHelperVisible } from './use-is-axes-helper-visible';

test('it toggles axes helper visibility', () => {
  const hook = renderHook(() => useIsAxesHelperVisible());

  expect(hook.result.current).toBeFalse();

  toggleAxesHelper();
  hook.rerender();

  expect(hook.result.current).toBeTrue();

  toggleAxesHelper();
  hook.rerender();

  expect(hook.result.current).toBeFalse();
});

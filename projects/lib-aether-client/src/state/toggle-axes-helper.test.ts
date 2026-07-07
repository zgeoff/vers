import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { toggleAxesHelper } from './toggle-axes-helper';
import { useIsAxesHelperVisible } from './use-is-axes-helper-visible';

test('it toggles axes helper visibility', () => {
  const rendered = renderHook(() => useIsAxesHelperVisible());

  expect(rendered.result.current).toBeFalse();

  toggleAxesHelper();
  rendered.rerender();

  expect(rendered.result.current).toBeTrue();

  toggleAxesHelper();
  rendered.rerender();

  expect(rendered.result.current).toBeFalse();
});

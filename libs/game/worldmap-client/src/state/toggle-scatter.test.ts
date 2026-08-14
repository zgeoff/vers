import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { toggleScatter } from './toggle-scatter';
import { useIsScatterVisible } from './use-is-scatter-visible';

test('it toggles scatter visibility from true to false', () => {
  const hook = renderHook(() => useIsScatterVisible());

  expect(hook.result.current).toBeTrue();

  toggleScatter();

  hook.rerender();

  expect(hook.result.current).toBeFalse();

  toggleScatter();

  hook.rerender();

  expect(hook.result.current).toBeTrue();
});

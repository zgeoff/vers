import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIsScatterVisible } from './use-is-scatter-visible';

test('it returns the current scatter visibility state', () => {
  const hook = renderHook(() => useIsScatterVisible());

  expect(hook.result.current).toBeTrue();
});

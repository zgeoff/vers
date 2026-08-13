import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIsFogOfWarVisible } from './use-is-fog-of-war-visible';

test('it returns the current fog-of-war visibility state', () => {
  const hook = renderHook(() => useIsFogOfWarVisible());

  expect(hook.result.current).toBeTrue();
});

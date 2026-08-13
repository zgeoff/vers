import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { toggleFogOfWar } from './toggle-fog-of-war';
import { useIsFogOfWarVisible } from './use-is-fog-of-war-visible';

test('it toggles fog-of-war visibility from true to false', () => {
  const hook = renderHook(() => useIsFogOfWarVisible());

  expect(hook.result.current).toBeTrue();

  toggleFogOfWar();

  hook.rerender();

  expect(hook.result.current).toBeFalse();

  toggleFogOfWar();

  hook.rerender();

  expect(hook.result.current).toBeTrue();
});

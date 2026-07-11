import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { setSimulationInitialized } from './set-simulation-initialized';
import { useSimulationInitialized } from './use-simulation-initialized';

test('it updates the simulation initialized state', () => {
  const hook = renderHook(() => useSimulationInitialized());

  expect(hook.result.current).toBeFalse();
  setSimulationInitialized(true);

  hook.rerender();

  expect(hook.result.current).toBeTrue();
});

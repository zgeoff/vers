import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { setSimulationInitialized } from './set-simulation-initialized';
import { useSimulationInitialized } from './use-simulation-initialized';

test('it updates the simulation initialized state', () => {
  const { rerender, result } = renderHook(() => useSimulationInitialized());

  expect(result.current).toBeFalse();

  setSimulationInitialized(true);

  rerender();

  expect(result.current).toBeTrue();
});

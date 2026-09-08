import { expect, test } from 'bun:test';
import { setSimulationSpeed } from './set-simulation-speed';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored simulation speed wholesale', () => {
  setSimulationSpeed(20);

  expect(useIdleStore.getState().simulationSpeed).toBe(20);

  setSimulationSpeed(1);

  expect(useIdleStore.getState().simulationSpeed).toBe(1);
});

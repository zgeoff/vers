import type { Simulation } from '@vers/idle-core';
import { handleSimulationUpdate } from './handle-simulation-update';
import type { WorkerContext } from './types';

export function registerSimulationListeners(context: WorkerContext, simulation: Simulation): void {
  simulation.addEventListener('updated', () => {
    handleSimulationUpdate(context);
  });
}

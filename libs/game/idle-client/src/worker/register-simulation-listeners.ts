import type { Simulation } from '@vers/idle-core';
import { handleSimulationUpdate } from './handle-simulation-update';
import type { WorkerContext } from './types';

/**
 * Wires a simulation's lifecycle events to the runtime's handlers — every simulation the worker
 * ever installs, whether the one `initialize` creates or one a resync reconstructs, broadcasts the
 * same way.
 */
export function registerSimulationListeners(context: WorkerContext, simulation: Simulation): void {
  simulation.addEventListener('updated', () => {
    handleSimulationUpdate(context);
  });
}

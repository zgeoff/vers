import { createSimulation } from '@vers/idle-core';
import { registerSimulationListeners } from './register-simulation-listeners';
import type { WorkerContext } from './types';

/**
 * Returns the runtime to its idle state: a fresh, empty simulation installs and the activity
 * clears. The worker always holds a simulation — "no run" is an empty one — and a finished
 * instance is replaced rather than kept because stopping only detaches its activity; its avatar
 * and combat state would otherwise linger in every later snapshot a connecting tab receives.
 */
export function resetSimulation(context: WorkerContext): void {
  const replacement = createSimulation();

  registerSimulationListeners(context, replacement);

  context.setSimulation(replacement);
  context.setActivity(null);
}

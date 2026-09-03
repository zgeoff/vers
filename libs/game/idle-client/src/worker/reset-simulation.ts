import { createSimulation } from '@vers/idle-core';
import { registerSimulationListeners } from './register-simulation-listeners';
import type { WorkerContext } from './types';

export function resetSimulation(context: WorkerContext): void {
  const replacement = createSimulation();

  registerSimulationListeners(context, replacement);

  context.setSimulation(replacement);
  context.setActivity(null);
}

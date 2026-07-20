import { createSimulationUpdateMessage } from './create-simulation-update-message';
import type { WorkerContext } from './types';

export function handleSimulationUpdate(context: WorkerContext) {
  const simulation = context.getSimulation();

  for (const connection of context.connections) {
    const message = createSimulationUpdateMessage(simulation.getSnapshot());

    connection.postMessage(message);
  }
}

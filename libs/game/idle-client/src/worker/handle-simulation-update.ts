import invariant from 'tiny-invariant';
import { createSimulationUpdateMessage } from './create-simulation-update-message';
import type { WorkerContext } from './types';

export function handleSimulationUpdate(context: WorkerContext) {
  const simulation = context.getSimulation();

  invariant(simulation, 'simulation is required');

  for (const connection of context.connections) {
    const message = createSimulationUpdateMessage(simulation.getSnapshot());

    connection.postMessage(message);
  }
}

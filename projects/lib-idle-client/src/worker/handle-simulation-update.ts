import invariant from 'tiny-invariant';
import { createSimulationUpdateMessage } from './create-simulation-update-message';
import type { WorkerContext } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerContext's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
export function handleSimulationUpdate(context: WorkerContext) {
  const simulation = context.getSimulation();

  invariant(simulation, 'simulation is required');

  for (const connection of context.connections) {
    const message = createSimulationUpdateMessage(simulation.getAppState());

    connection.postMessage(message);
  }
}

import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

export function handleSimulationUpdate(context: WorkerContext) {
  const simulation = context.getSimulation();

  const message = {
    state: simulation.getSnapshot(),
    type: WorkerMessageType.SimulationUpdate,
  } satisfies WorkerMessage;

  context.broadcast(message);
}

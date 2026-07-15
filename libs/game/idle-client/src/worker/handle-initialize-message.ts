import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import type { WorkerContext } from './types';

export function handleInitializeMessage(context: WorkerContext, _message: InitializeMessage) {
  // bail out if we already have a simulation initialized
  if (context.getSimulation()) {
    return;
  }

  const simulation = createSimulation();

  context.setSimulation(simulation);

  const initialStateMessage = createInitialStateMessage(simulation.getSnapshot());

  for (const connection of context.connections) {
    connection.postMessage(initialStateMessage);
  }

  registerSimulationListeners(context, simulation);
}

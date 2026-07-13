import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';
import { handleSimulationRestarted } from './handle-simulation-restarted';
import { handleSimulationStarted } from './handle-simulation-started';
import { handleSimulationStopped } from './handle-simulation-stopped';
import { handleSimulationUpdate } from './handle-simulation-update';
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

  simulation.addEventListener('updated', () => {
    handleSimulationUpdate(context);
  });

  simulation.addEventListener('stopped', () => {
    handleSimulationStopped(context);
  });

  simulation.addEventListener('started', () => {
    handleSimulationStarted(context);
  });

  simulation.addEventListener('restarted', () => {
    handleSimulationRestarted(context);
  });
}

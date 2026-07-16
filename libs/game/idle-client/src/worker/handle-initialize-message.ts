import type { Simulation } from '@vers/idle-core';
import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';
import { handleSimulationRestarted } from './handle-simulation-restarted';
import { handleSimulationStarted } from './handle-simulation-started';
import { handleSimulationStopped } from './handle-simulation-stopped';
import { handleSimulationUpdate } from './handle-simulation-update';
import type { WorkerContext } from './types';

/**
 * Answers an initialize with the worker's current state: it creates the one simulation on the
 * first initialize and reuses it afterward, then broadcasts the snapshot and the retained
 * reward-slot ledger to every connection — so a tab connecting mid-run catches up rather than
 * starting empty.
 */
export function handleInitializeMessage(context: WorkerContext, _message: InitializeMessage) {
  const simulation = context.getSimulation() ?? createSimulationForContext(context);

  const initialStateMessage = createInitialStateMessage(
    simulation.getSnapshot(),
    context.getRewardSlotLedger(),
  );

  for (const connection of context.connections) {
    connection.postMessage(initialStateMessage);
  }
}

function createSimulationForContext(context: WorkerContext): Simulation {
  const simulation = createSimulation();

  context.setSimulation(simulation);

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

  return simulation;
}

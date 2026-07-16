import type { Simulation } from '@vers/idle-core';
import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';
import { registerSimulationListeners } from './register-simulation-listeners';
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

  registerSimulationListeners(context, simulation);

  return simulation;
}

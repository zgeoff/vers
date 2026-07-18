import type { Simulation } from '@vers/idle-core';
import { createSimulation } from '@vers/idle-core';
import type { InitializeMessage } from '../types';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import { createInitialStateMessage } from './create-initial-state-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import type { WorkerContext } from './types';

/**
 * Answers an initialize with the worker's current state: it creates the one simulation on the
 * first initialize and reuses it afterward, then broadcasts the snapshot and the retained
 * reward-slot ledger to every connection — so a tab connecting mid-run catches up rather than
 * starting empty. Also broadcasts the effective failure-action preference, so a connecting tab
 * reflects it even before any simulation snapshot carries one.
 */
export function handleInitializeMessage(context: WorkerContext, _message: InitializeMessage) {
  const simulation = context.getSimulation() ?? createSimulationForContext(context);

  const initialStateMessage = createInitialStateMessage(
    simulation.getSnapshot(),
    context.getRewardSlotLedger(),
  );

  const failureActionStatusMessage = createFailureActionStatusMessage(context.getFailureAction());

  for (const connection of context.connections) {
    connection.postMessage(initialStateMessage);
    connection.postMessage(failureActionStatusMessage);
  }
}

function createSimulationForContext(context: WorkerContext): Simulation {
  const simulation = createSimulation();

  context.setSimulation(simulation);

  registerSimulationListeners(context, simulation);

  return simulation;
}

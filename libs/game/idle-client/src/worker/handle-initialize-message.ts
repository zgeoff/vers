import type { InitializeMessage } from '../types';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import { createInitialStateMessage } from './create-initial-state-message';
import type { WorkerContext } from './types';

/**
 * Answers an initialize by broadcasting the worker's current snapshot and retained reward-slot
 * ledger to every connection — so a tab connecting mid-run catches up rather than starting empty.
 * Also broadcasts the effective failure-action preference, so a connecting tab reflects it even
 * before any simulation snapshot carries one.
 */
export function handleInitializeMessage(context: WorkerContext, _message: InitializeMessage) {
  const simulation = context.getSimulation();

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

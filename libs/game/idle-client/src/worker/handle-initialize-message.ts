import { WorkerMessageType } from '../types';
import type { InitializeMessage } from './client-to-worker-message-schema';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

/**
 * Answers an initialize with the worker's current state, broadcasting the snapshot and the
 * retained reward-slot ledger to every connection — so a tab connecting mid-run catches up rather
 * than starting empty. Also broadcasts the effective failure-action preference, so a connecting
 * tab reflects it even before any simulation snapshot carries one.
 */
export function handleInitializeMessage(context: WorkerContext, _message: InitializeMessage) {
  const initialStateMessage = {
    rewardSlotLedger: context.getRewardSlotLedger(),
    state: context.getSimulation().getSnapshot(),
    type: WorkerMessageType.InitialState,
    writerDisplacedActivityID: context.getWriterDisplacedActivityID(),
  } satisfies WorkerMessage;

  const failureActionStatusMessage = {
    failureAction: context.getFailureAction(),
    type: WorkerMessageType.FailureActionStatus,
  } satisfies WorkerMessage;

  for (const connection of context.connections) {
    connection.postMessage(initialStateMessage);
    connection.postMessage(failureActionStatusMessage);
  }
}

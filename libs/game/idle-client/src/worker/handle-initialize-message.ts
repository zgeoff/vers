import type { WorkerContext } from './types';
import type { InitializeOutput } from './worker-contract';

/**
 * Answers an initialize with the worker's current state: the live snapshot, the retained
 * reward-slot ledger, and any held writer displacement — so a tab connecting mid-run catches up
 * rather than starting empty. The snapshot itself carries the effective failure-action preference.
 */
export function handleInitializeMessage(context: WorkerContext): InitializeOutput {
  return {
    rewardSlotLedger: context.getRewardSlotLedger(),
    state: context.getSimulation().getSnapshot(),
    writerDisplacedActivityID: context.getWriterDisplacedActivityID(),
  };
}

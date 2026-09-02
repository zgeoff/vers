import type { WorkerContext } from './types';
import type { InitializeOutput } from './worker-contract';

export function handleInitializeMessage(context: WorkerContext): InitializeOutput {
  return {
    rewardSlotLedger: context.getRewardSlotLedger(),
    state: context.getSimulation().getSnapshot(),
    writerDisplacedActivityID: context.getWriterDisplacedActivityID(),
  };
}

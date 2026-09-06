import { findLiveRun } from './find-live-run';
import type { WorkerContext } from './types';
import type { InitializeOutput } from './worker-contract';

export function handleInitializeMessage(context: WorkerContext): InitializeOutput {
  const liveRun = findLiveRun(context);

  return {
    ...(liveRun !== undefined && { liveRun }),
    rewardSlotLedger: context.getRewardSlotLedger(),
    state: context.getSimulation().getSnapshot(),
    writerDisplacedActivityID: context.getWriterDisplacedActivityID(),
  };
}

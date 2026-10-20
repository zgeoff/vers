import type {
  ActivityCheckpoint,
  ReplaySegmentInput,
  ReplaySegmentOutput,
} from '@vers/contract-replay';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '@vers/idle-core';
import type {
  ActivityCheckpoint as EngineActivityCheckpoint,
  ActivityInput as EngineActivityInput,
} from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import { match } from 'ts-pattern';

export async function runReplaySimulation(input: ReplaySegmentInput): Promise<ReplaySegmentOutput> {
  const result = await runSimulation(toEngineActivityInput(input.activity), input.avatar, {
    duration: input.duration,
    ...(input.expectedCheckpointCount !== undefined && {
      expectedCheckpointCount: input.expectedCheckpointCount,
    }),
    ...(input.stopAtState !== undefined && { stopAtState: input.stopAtState }),
  });

  return {
    checkpoints: result.checkpoints.map(toWireActivityCheckpoint),
    elapsed: result.elapsed,
    ...(result.haltedOnDurationCap !== undefined && {
      haltedOnDurationCap: result.haltedOnDurationCap,
    }),
  };
}

const ENGINE_FAILURE_ACTIONS: Record<
  ReplaySegmentInput['activity']['failureAction'],
  ActivityFailureAction
> = {
  abort: ActivityFailureAction.Abort,
  retry: ActivityFailureAction.Retry,
};

function toEngineActivityInput(activity: ReplaySegmentInput['activity']): EngineActivityInput {
  return {
    ...activity,
    failureAction: ENGINE_FAILURE_ACTIONS[activity.failureAction],
    type: ActivityType.WorldMapEncounter,
  };
}

function toWireActivityCheckpoint(checkpoint: EngineActivityCheckpoint): ActivityCheckpoint {
  const shared = {
    nextSeed: checkpoint.nextSeed,
    rewards: checkpoint.rewards,
    rewardSlots: checkpoint.rewardSlots.map((slot) => ({ ...slot, context: { ...slot.context } })),
    time: checkpoint.time,
    ...(checkpoint.levelUp !== undefined && { levelUp: checkpoint.levelUp }),
  };

  return match(checkpoint)
    .returnType<ActivityCheckpoint>()
    .with({ type: ActivityCheckpointType.Started }, (started) => ({
      ...shared,
      seed: started.seed,
      type: 'started',
    }))
    .with({ type: ActivityCheckpointType.Failed }, () => ({ ...shared, type: 'failed' }))
    .with({ type: ActivityCheckpointType.Completed }, () => ({ ...shared, type: 'completed' }))
    .with({ type: ActivityCheckpointType.Progress }, () => ({ ...shared, type: 'progress' }))
    .exhaustive();
}

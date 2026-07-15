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
import { UnreachableCodeError } from '@vers/utils';

/**
 * Re-runs a simulation segment against this process's engine, converting the wire input and
 * engine output across the boundary. Callers own the `simVersion` check — this always runs the
 * engine it was built against.
 */
export async function runReplaySimulation(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- input.activity/avatar are zod-inferred wire types with no readonly form
  input: ReplaySegmentInput,
): Promise<ReplaySegmentOutput> {
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

/**
 * The wire input's `failureAction`/`type` are plain string literals; the engine's own types brand
 * them as enum members, so the boundary needs an explicit (exhaustive, cast-free) conversion.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- zod-inferred wire type (enemies array) has no readonly form
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
    time: checkpoint.time,
    ...(checkpoint.levelUp !== undefined && { levelUp: checkpoint.levelUp }),
  };

  switch (checkpoint.type) {
    case ActivityCheckpointType.Started: {
      return { ...shared, seed: checkpoint.seed, type: 'started' };
    }

    case ActivityCheckpointType.Failed: {
      return { ...shared, type: 'failed' };
    }

    case ActivityCheckpointType.Completed: {
      return { ...shared, type: 'completed' };
    }

    case ActivityCheckpointType.Progress: {
      return { ...shared, type: 'progress' };
    }

    default: {
      throw new UnreachableCodeError('every ActivityCheckpointType is handled above');
    }
  }
}

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
import type { SimVersionMismatchPayload } from '../types';

interface ReplaySegmentDeps {
  readonly simVersion: string;
}

/**
 * oRPC handler opts for the `replaySegment` procedure.
 */
interface ReplaySegmentOpts {
  readonly errors: {
    readonly SIM_VERSION_MISMATCH: (payload: SimVersionMismatchPayload) => Error;
  };
  readonly input: ReplaySegmentInput;
}

/**
 * Re-runs a simulation segment against this provider's baked engine. A request whose `simVersion`
 * doesn't match the provider's own baked hash is refused before the engine ever runs — the dispatch
 * misroute guard the version stamp exists for.
 */
export async function replaySegment(
  deps: ReplaySegmentDeps,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- input.activity/avatar are zod-inferred wire types with no readonly form
  opts: ReplaySegmentOpts,
): Promise<ReplaySegmentOutput> {
  if (opts.input.simVersion !== deps.simVersion) {
    throw opts.errors.SIM_VERSION_MISMATCH({ data: { providerSimVersion: deps.simVersion } });
  }

  const result = await runSimulation(
    toEngineActivityInput(opts.input.activity),
    opts.input.avatar,
    {
      duration: opts.input.duration,
      ...(opts.input.stopAtState !== undefined && { stopAtState: opts.input.stopAtState }),
    },
  );

  return {
    checkpoints: result.checkpoints.map(toWireActivityCheckpoint),
    elapsed: result.elapsed,
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

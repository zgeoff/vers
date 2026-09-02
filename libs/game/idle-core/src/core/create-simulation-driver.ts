import { UnreachableCodeError } from '@vers/utils';
import type {
  ActivityCheckpoint,
  ActivityInput,
  AvatarData,
  SimulationAdvanceResult,
  SimulationDriver,
} from '../types';
import { ActivityFailureAction } from '../types';
import { isCompletedCheckpoint } from '../utils/is-completed-checkpoint';
import { isFailedCheckpoint } from '../utils/is-failed-checkpoint';
import { isProgressCheckpoint } from '../utils/is-progress-checkpoint';
import { isStartedCheckpoint } from '../utils/is-started-checkpoint';
import { createSimulation } from './create-simulation';
import { SIMULATION_TIMESTEP_MS } from './simulation-timestep-ms';

export function createSimulationDriver(
  activity: ActivityInput,
  avatarData: AvatarData,
): SimulationDriver {
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activity);

  let isTerminated = false;

  // oxlint-disable-next-line require-await -- kept async so cross-package callers can keep awaiting this driver-facing API; the engine step itself is synchronous
  const advanceToDuration = async (
    duration: number,
    stopAtState?: string,
    expectedCheckpointCount?: number,
    // oxlint-disable-next-line typescript/require-await -- kept async so cross-package callers can keep awaiting this driver-facing API; the engine step itself is synchronous
  ): Promise<SimulationAdvanceResult> => {
    const checkpoints: Array<ActivityCheckpoint> = [];

    if (isTerminated) {
      return { checkpoints, haltedOnDurationCap: false };
    }

    while (simulation.elapsed < duration) {
      const checkpoint = simulation.run(SIMULATION_TIMESTEP_MS);

      if (!checkpoint) {
        continue;
      }

      checkpoints.push(checkpoint);

      if (checkpoints.length === expectedCheckpointCount) {
        return { checkpoints, haltedOnDurationCap: false };
      }

      // A zero-consumption checkpoint can share its rngState with an earlier one in the same
      // tail (a terminal that rolls nothing further than the checkpoint before it) — with a known
      // count driving the halt, stopAtState is only a sanity signal, never an independent stop.
      if (
        expectedCheckpointCount === undefined &&
        stopAtState !== undefined &&
        simulation.rngState === stopAtState
      ) {
        return { checkpoints, haltedOnDurationCap: false };
      }

      if (isStartedCheckpoint(checkpoint)) {
        continue;
      }

      const isFailed = isFailedCheckpoint(checkpoint);

      if (isFailed && activity.failureAction === ActivityFailureAction.Abort) {
        isTerminated = true;

        return { checkpoints, haltedOnDurationCap: false };
      }

      if (isFailed && activity.failureAction === ActivityFailureAction.Retry) {
        simulation.restartActivity();
        continue;
      }

      if (isProgressCheckpoint(checkpoint)) {
        continue;
      }

      if (isCompletedCheckpoint(checkpoint)) {
        simulation.restartActivity();
        continue;
      }

      throw new UnreachableCodeError('every ActivityCheckpointType is handled above');
    }

    return {
      checkpoints,
      haltedOnDurationCap:
        expectedCheckpointCount !== undefined && checkpoints.length < expectedCheckpointCount,
    };
  };

  return {
    advanceToDuration,
    get elapsed() {
      return simulation.elapsed;
    },
    get rngState() {
      return simulation.rngState;
    },
    stop: () => {
      simulation.stopActivity();

      return Promise.resolve();
    },
  };
}

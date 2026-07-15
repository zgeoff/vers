import { UnreachableCodeError } from '@vers/utils';
import type { ActivityCheckpoint, ActivityInput, AvatarData, SimulationDriver } from '../types';
import { ActivityFailureAction } from '../types';
import { isCompletedCheckpoint } from '../utils/is-completed-checkpoint';
import { isFailedCheckpoint } from '../utils/is-failed-checkpoint';
import { isProgressCheckpoint } from '../utils/is-progress-checkpoint';
import { isStartedCheckpoint } from '../utils/is-started-checkpoint';
import { createSimulation } from './create-simulation';
import { SIMULATION_TIMESTEP_MS } from './simulation-timestep-ms';

/**
 * Starts one live simulation on `(activity, avatar)` and returns a driver that advances it in
 * `SIMULATION_TIMESTEP_MS` steps up to a requested duration, capturing every checkpoint the
 * engine emits along the way — including a `Failed` retry's or a `Completed` clear's restart, so
 * a multi-wave, multi-attempt stream keeps flowing across calls exactly as it would in one call.
 * A tick that would carry `elapsed` past the requested `duration` is left uncommitted to the
 * returned checkpoints and the loop stops for this call only; the caller decides whether that's
 * the stream's true end (and stops the underlying simulation) or the boundary of one batch among
 * more to come.
 */
export function createSimulationDriver(
  activity: ActivityInput,
  avatarData: AvatarData,
): SimulationDriver {
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activity);

  const advanceToDuration = async (
    duration: number,
    stopAtState?: string,
  ): Promise<Array<ActivityCheckpoint>> => {
    const checkpoints: Array<ActivityCheckpoint> = [];

    while (simulation.elapsed < duration) {
      if (simulation.rngState === stopAtState) {
        break;
      }

      const checkpoint = await simulation.run(SIMULATION_TIMESTEP_MS);

      if (!checkpoint) {
        continue;
      }

      if (simulation.elapsed > duration) {
        break;
      }

      checkpoints.push(checkpoint);

      if (isStartedCheckpoint(checkpoint)) {
        continue;
      }

      const isFailed = isFailedCheckpoint(checkpoint);

      if (isFailed && activity.failureAction === ActivityFailureAction.Abort) {
        break;
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

    return checkpoints;
  };

  return {
    advanceToDuration,
    get elapsed() {
      return simulation.elapsed;
    },
    get rngState() {
      return simulation.rngState;
    },
    stop: () => simulation.stopActivity(),
  };
}

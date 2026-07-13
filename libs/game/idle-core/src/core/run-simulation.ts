import { UnreachableCodeError } from '@vers/utils';
import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { ActivityFailureAction } from '../types';
import { isCompletedCheckpoint } from '../utils/is-completed-checkpoint';
import { isFailedCheckpoint } from '../utils/is-failed-checkpoint';
import { isProgressCheckpoint } from '../utils/is-progress-checkpoint';
import { isStartedCheckpoint } from '../utils/is-started-checkpoint';
import { logger } from '../utils/logger';
import { createSimulation } from './create-simulation';

/**
 * @property duration - how long to run the simulation for. derive from the checkpoint data submitted by the
 * cient, or if simulating offline progress the duration since the last checkpoint (if any)
 * @property stopAtState - if a final rng state is provided we will stop processing once we've reached it. useful for
 * verifying client progress.
 */
interface SimulationConfig {
  readonly duration: number;
  readonly stopAtState?: string;
}

interface SimulationOutput {
  checkpoints: Array<ActivityCheckpoint>;
  elapsed: number;
}

const SERVER_SIMULATION_INTERVAL = 100;

export async function runSimulation(
  activity: ActivityInput,
  avatar: AvatarData,
  config: SimulationConfig,
): Promise<SimulationOutput> {
  const label = `[activity:${activity.type}]`;

  logger.debug(`${label} starting simulation`);

  const simulation = createSimulation();

  simulation.startActivity(avatar, activity);

  const checkpoints: Array<ActivityCheckpoint> = [];

  while (simulation.elapsed < config.duration) {
    // bail out if we've reached our desired rng state
    if (simulation.rngState === config.stopAtState) {
      logger.debug(`${label} stopping at rng state ${simulation.rngState}`);
      break;
    }

    // run out simulation for our interval
    const checkpoint = await simulation.run(SERVER_SIMULATION_INTERVAL);

    if (!checkpoint) {
      continue;
    }

    // bail out if we've exceeded our duration
    if (simulation.elapsed > config.duration) {
      await simulation.stopActivity();

      logger.debug(`${label} activity exceeded duration, aborting`);
      break;
    }

    // it's important we capture all checkpoints so we can replay even from a failure
    checkpoints.push(checkpoint);

    if (isStartedCheckpoint(checkpoint)) {
      logger.debug(`${label} activity started`);
      continue;
    }

    const isFailed = isFailedCheckpoint(checkpoint);

    if (isFailed && activity.failureAction === ActivityFailureAction.Abort) {
      logger.debug(`${label} activity failed, aborting`);
      break;
    }

    if (isFailed && activity.failureAction === ActivityFailureAction.Retry) {
      logger.debug(`${label} activity failed, retrying`);
      simulation.restartActivity();
      continue;
    }

    if (isProgressCheckpoint(checkpoint)) {
      logger.debug(`${label} progress checkpoint`);
      continue;
    }

    if (isCompletedCheckpoint(checkpoint)) {
      logger.debug(`${label} activity completed`);
      simulation.restartActivity();
      continue;
    }

    throw new UnreachableCodeError('we should never get here');
  }

  logger.debug(`${label} completed simulation`);

  return { checkpoints, elapsed: simulation.elapsed };
}

import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { isCompletedCheckpoint } from '../utils/is-completed-checkpoint';
import { isFailedCheckpoint } from '../utils/is-failed-checkpoint';
import { createSimulation } from './create-simulation';
import { SIMULATION_TIMESTEP_MS } from './simulation-timestep-ms';

interface RunAttemptConfig {
  readonly maxDurationMs: number;

  readonly timestepMs?: number;
}

interface RunAttemptResult {
  readonly checkpoints: Array<ActivityCheckpoint>;
  readonly elapsed: number;
  readonly outcome: 'completed' | 'exceeded-budget' | 'failed';
}

// oxlint-disable-next-line typescript/require-await -- kept async so cross-package callers can keep awaiting this driver-facing API; the engine step itself is synchronous
export async function runAttempt(
  activity: ActivityInput,
  avatar: AvatarData,
  config: RunAttemptConfig,
): Promise<RunAttemptResult> {
  const timestepMs = config.timestepMs ?? SIMULATION_TIMESTEP_MS;
  const simulation = createSimulation();

  simulation.startActivity(avatar, activity);

  const checkpoints: Array<ActivityCheckpoint> = [];

  while (simulation.elapsed < config.maxDurationMs) {
    const checkpoint = simulation.run(timestepMs);

    if (simulation.elapsed > config.maxDurationMs) {
      break;
    }

    if (!checkpoint) {
      continue;
    }

    checkpoints.push(checkpoint);

    if (isFailedCheckpoint(checkpoint)) {
      return { checkpoints, elapsed: simulation.elapsed, outcome: 'failed' };
    }

    if (isCompletedCheckpoint(checkpoint)) {
      return { checkpoints, elapsed: simulation.elapsed, outcome: 'completed' };
    }
  }

  simulation.stopActivity();

  return { checkpoints: [], elapsed: simulation.elapsed, outcome: 'exceeded-budget' };
}

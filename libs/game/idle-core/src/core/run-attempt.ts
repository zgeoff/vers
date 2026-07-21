import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { isCompletedCheckpoint } from '../utils/is-completed-checkpoint';
import { isFailedCheckpoint } from '../utils/is-failed-checkpoint';
import { createSimulation } from './create-simulation';
import { SIMULATION_TIMESTEP_MS } from './simulation-timestep-ms';

interface RunAttemptConfig {
  /**
   * Simulated-time ceiling for the attempt, in milliseconds. An attempt whose terminal checkpoint
   * has not landed inside this budget is discarded whole.
   */
  readonly maxDurationMs: number;

  /**
   * Engine tick size in milliseconds. Every driver of the same stream must use the same value or
   * replay diverges; override only to drive tests.
   */
  readonly timestepMs?: number;
}

interface RunAttemptResult {
  /**
   * The attempt's full stream, started through terminal, in order — or empty when the outcome is
   * `exceeded-budget`, so a caller can never submit a stream that ends mid-encounter.
   */
  readonly checkpoints: Array<ActivityCheckpoint>;
  readonly elapsed: number;
  readonly outcome: 'completed' | 'exceeded-budget' | 'failed';
}

/**
 * Runs exactly one attempt at an activity: a fresh simulation ticked until the first terminal
 * checkpoint, never restarting through failure or completion — retry policy across attempts is
 * the caller's. The result is committed only when its terminal landed at or under
 * `maxDurationMs`; the tick that crosses the budget contributes nothing.
 */
// oxlint-disable-next-line typescript/require-await -- kept async so cross-package callers can keep awaiting this driver-facing API; the engine now steps synchronously with no internal await
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

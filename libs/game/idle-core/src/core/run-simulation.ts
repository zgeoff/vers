import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { createSimulationDriver } from './create-simulation-driver';

/**
 * @property duration - how long to run the simulation for. derive from the checkpoint data submitted by the
 * cient, or if simulating offline progress the duration since the last checkpoint (if any)
 * @property expectedCheckpointCount - when the caller knows exactly how many checkpoints the run should
 * produce (a replay), the primary halt condition; `duration` is only the safety cap behind it.
 * @property stopAtState - if a final rng state is provided we will stop processing once we've reached it. useful for
 * verifying client progress.
 */
interface SimulationConfig {
  readonly duration: number;
  readonly expectedCheckpointCount?: number;
  readonly stopAtState?: string;
}

interface SimulationOutput {
  checkpoints: Array<ActivityCheckpoint>;
  elapsed: number;
  haltedOnDurationCap?: boolean;
}

/**
 * Runs one activity from `Started` to `config.duration` in a single call, stopping the underlying
 * simulation once any tick crosses `duration` — the one-shot path's own termination, never shared
 * with a caller advancing the same simulation across several calls (`createSimulationDriver`).
 */
export async function runSimulation(
  activity: ActivityInput,
  avatar: AvatarData,
  config: SimulationConfig,
): Promise<SimulationOutput> {
  const driver = createSimulationDriver(activity, avatar);

  const result = await driver.advanceToDuration(
    config.duration,
    config.stopAtState,
    config.expectedCheckpointCount,
  );

  if (driver.elapsed > config.duration) {
    await driver.stop();
  }

  return {
    checkpoints: result.checkpoints,
    elapsed: driver.elapsed,
    ...(result.haltedOnDurationCap && { haltedOnDurationCap: true }),
  };
}

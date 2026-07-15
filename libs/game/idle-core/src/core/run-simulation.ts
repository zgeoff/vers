import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { createSimulationDriver } from './create-simulation-driver';

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

/**
 * Runs one activity from `Started` to `config.duration` in a single call, stopping the underlying
 * simulation only when a tick's checkpoint would carry `elapsed` past `duration` — the one-shot
 * path's own termination, never shared with a caller advancing the same simulation across several
 * calls (`createSimulationDriver`).
 */
export async function runSimulation(
  activity: ActivityInput,
  avatar: AvatarData,
  config: SimulationConfig,
): Promise<SimulationOutput> {
  const driver = createSimulationDriver(activity, avatar);

  const checkpoints = await driver.advanceToDuration(config.duration, config.stopAtState);

  if (driver.elapsed > config.duration) {
    await driver.stop();
  }

  return { checkpoints, elapsed: driver.elapsed };
}

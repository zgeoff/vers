import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { createSimulationDriver } from './create-simulation-driver';

interface SimulationConfig {
  /**
   * Derived from the checkpoint data submitted by the client, or — when simulating offline
   * progress — the duration since the last checkpoint, if any.
   */
  readonly duration: number;

  /**
   * When the caller knows exactly how many checkpoints the run should produce (a replay), the
   * primary halt condition; `duration` is only the safety cap behind it.
   */
  readonly expectedCheckpointCount?: number;

  /**
   * When a final rng state is provided, processing stops once it's reached — useful for verifying
   * client progress.
   */
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
 * with a caller that advances the same simulation across several calls.
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

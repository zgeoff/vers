import type { ActivityCheckpoint, ActivityInput, AvatarData } from '../types';
import { createSimulationDriver } from './create-simulation-driver';

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

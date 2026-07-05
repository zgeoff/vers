import type { Activity, ActivityFailedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createFailedCheckpoint(
  activity: Activity,
  ctx: SimulationContext,
): ActivityFailedCheckpoint {
  const result: Omit<ActivityFailedCheckpoint, 'hash'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Failed,
  };

  const hash = hashObject(ctx.hasher, result);

  return { ...result, hash };
}

import type { Activity, ActivityProgressCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createProgressCheckpoint(
  activity: Activity,
  ctx: SimulationContext,
): ActivityProgressCheckpoint {
  const data: Omit<ActivityProgressCheckpoint, 'hash'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
  };

  const hash = hashObject(ctx.hasher, data);

  return { ...data, hash };
}

import type {
  Activity,
  ActivityProgressCheckpoint,
  ActivityRewards,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createProgressCheckpoint(
  activity: Activity,
  ctx: SimulationContext,
  rewards: ActivityRewards,
): ActivityProgressCheckpoint {
  // hash chain covers only this frozen subset — rewards ride outside it, verified by server
  // replay-recompute instead
  const hashed: Omit<ActivityProgressCheckpoint, 'hash' | 'rewards'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
  };

  const hash = hashObject(ctx.hasher, hashed);

  return { ...hashed, hash, rewards };
}

import type {
  Activity,
  ActivityFailedCheckpoint,
  ActivityRewards,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createFailedCheckpoint(
  activity: Activity,
  ctx: SimulationContext,
): ActivityFailedCheckpoint {
  // hash chain covers only this frozen subset — rewards ride outside it, verified by server
  // replay-recompute instead
  const hashed: Omit<ActivityFailedCheckpoint, 'hash' | 'rewards'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Failed,
  };

  const hash = hashObject(ctx.hasher, hashed);

  // defeat cost (negative xp) lands here once the content layer defines its magnitude
  const rewards: ActivityRewards = { xp: 0 };

  return { ...hashed, hash, rewards };
}

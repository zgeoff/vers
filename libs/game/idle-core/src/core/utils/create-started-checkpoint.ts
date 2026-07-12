import type { ActivityRewards, ActivityStartedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createStartedCheckpoint(ctx: SimulationContext): ActivityStartedCheckpoint {
  // hash chain covers only this frozen subset — rewards ride outside it, verified by server
  // replay-recompute instead
  const hashed: Omit<ActivityStartedCheckpoint, 'hash' | 'rewards'> = {
    seed: ctx.rng.seed,
    time: 0,
    type: ActivityCheckpointType.Started,
  };

  const hash = hashObject(ctx.hasher, hashed);
  const rewards: ActivityRewards = { xp: 0 };

  return { ...hashed, hash, rewards };
}

import type { ActivityCompletedCheckpoint, ActivityRewards, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createCompletedCheckpoint(
  elapsed: number,
  ctx: SimulationContext,
): ActivityCompletedCheckpoint {
  // hash chain covers only this frozen subset — rewards ride outside it, verified by server
  // replay-recompute instead
  const hashed: Omit<ActivityCompletedCheckpoint, 'hash' | 'rewards'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: elapsed,
    type: ActivityCheckpointType.Completed,
  };

  const hash = hashObject(ctx.hasher, hashed);

  // completion payouts land here once the content layer authors them
  const rewards: ActivityRewards = { xp: 0 };

  return { ...hashed, hash, rewards };
}

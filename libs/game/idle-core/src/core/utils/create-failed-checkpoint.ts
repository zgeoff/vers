import { buildFailureXPLoss } from '../../progression';
import type {
  Activity,
  ActivityFailedCheckpoint,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createFailedCheckpoint(
  activity: Activity,
  avatar: Avatar,
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
  const runningXP = avatar.xp + activity.rewards.xp;
  const loss = buildFailureXPLoss(runningXP);
  const rewards: ActivityRewards = { xp: activity.rewards.xp - loss };

  return { ...hashed, hash, rewards };
}

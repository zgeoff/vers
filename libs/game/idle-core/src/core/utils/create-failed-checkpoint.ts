import { buildFailureXPLoss } from '../../progression';
import type {
  Activity,
  ActivityFailedCheckpoint,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';

export function createFailedCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityFailedCheckpoint {
  const nextSeed = ctx.rng.getState();
  const time = activity.elapsed;
  const runningXP = avatar.xp + activity.rewards.xp;
  const loss = buildFailureXPLoss(runningXP);
  const rewards: ActivityRewards = { xp: activity.rewards.xp - loss };

  return { nextSeed, rewards, time, type: ActivityCheckpointType.Failed };
}

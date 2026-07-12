import { buildCompletionXP, levelForXP } from '../../progression';
import type {
  Activity,
  ActivityCompletedCheckpoint,
  ActivityLevelUp,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createCompletedCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityCompletedCheckpoint {
  // hash chain covers only this frozen subset — rewards and levelUp ride outside it, verified by
  // server replay-recompute instead
  const hashed: Omit<ActivityCompletedCheckpoint, 'hash' | 'levelUp' | 'rewards'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Completed,
  };

  const hash = hashObject(ctx.hasher, hashed);
  const completionXP = buildCompletionXP(activity.difficulty);
  const rewards: ActivityRewards = { xp: activity.rewards.xp + completionXP };
  const previousLevel = levelForXP(avatar.xp + activity.rewards.xp);
  const currentLevel = levelForXP(avatar.xp + rewards.xp);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return { ...hashed, hash, rewards, ...(levelUp && { levelUp }) };
}

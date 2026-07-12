import { levelForXP } from '../../progression';
import type {
  Activity,
  ActivityLevelUp,
  ActivityProgressCheckpoint,
  ActivityRewards,
  Avatar,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

/**
 * `activity.updateRewards(rewards)` must already have been applied by the caller — `rewards` is
 * this checkpoint's delta, while `activity.rewards` carries the running total it derives the level
 * crossing from.
 */
export function createProgressCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
  rewards: ActivityRewards,
): ActivityProgressCheckpoint {
  // hash chain covers only this frozen subset — rewards and levelUp ride outside it, verified by
  // server replay-recompute instead
  const hashed: Omit<ActivityProgressCheckpoint, 'hash' | 'levelUp' | 'rewards'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
  };

  const hash = hashObject(ctx.hasher, hashed);
  const totalXPAfter = avatar.xp + activity.rewards.xp;
  const totalXPBefore = totalXPAfter - rewards.xp;
  const previousLevel = levelForXP(totalXPBefore);
  const currentLevel = levelForXP(totalXPAfter);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return { ...hashed, hash, rewards, ...(levelUp && { levelUp }) };
}

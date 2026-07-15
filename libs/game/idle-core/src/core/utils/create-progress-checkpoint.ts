import { buildLevelFromXP } from '../../progression';
import type {
  Activity,
  ActivityLevelUp,
  ActivityProgressCheckpoint,
  ActivityRewards,
  Avatar,
  RewardSlotContext,
  SimulationContext,
} from '../../types';
import { ActivityCheckpointType } from '../../types';

/**
 * `activity.updateRewards(rewards)` must already have been applied by the caller — `rewards` is
 * this checkpoint's delta, while `activity.rewards` carries the running total it derives the level
 * crossing from. The reward-slot contexts earned since the last checkpoint are numbered here,
 * ordinals `0..n-1` in the order given, so they stay 0-contiguous within the checkpoint even when
 * more than one wave's contexts land in it.
 */
export function createProgressCheckpoint(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
  rewards: ActivityRewards,
  rewardSlotContexts: ReadonlyArray<RewardSlotContext>,
): ActivityProgressCheckpoint {
  const totalXPAfter = avatar.xp + activity.rewards.xp;
  const totalXPBefore = totalXPAfter - rewards.xp;
  const previousLevel = buildLevelFromXP(totalXPBefore);
  const currentLevel = buildLevelFromXP(totalXPAfter);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed: ctx.rng.getState(),
    rewards,
    rewardSlots: rewardSlotContexts.map((context, ordinal) => ({ context, ordinal })),
    time: activity.elapsed,
    type: ActivityCheckpointType.Progress,
    ...(levelUp && { levelUp }),
  };
}

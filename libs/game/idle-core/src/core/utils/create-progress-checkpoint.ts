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

interface CreateProgressCheckpointOptions {
  readonly activity: Activity;
  readonly avatar: Avatar;
  readonly ctx: SimulationContext;
  readonly rewards: ActivityRewards;
  readonly rewardSlotContexts: ReadonlyArray<RewardSlotContext>;
}

export function createProgressCheckpoint(
  options: CreateProgressCheckpointOptions,
): ActivityProgressCheckpoint {
  const totalXPAfter = options.avatar.xp + options.activity.rewards.xp;
  const totalXPBefore = totalXPAfter - options.rewards.xp;
  const previousLevel = buildLevelFromXP(totalXPBefore);
  const currentLevel = buildLevelFromXP(totalXPAfter);

  const levelUp: ActivityLevelUp | undefined =
    currentLevel > previousLevel ? { from: previousLevel, to: currentLevel } : undefined;

  return {
    nextSeed: options.ctx.rng.getState(),
    rewards: options.rewards,
    rewardSlots: options.rewardSlotContexts.map((context, ordinal) => ({ context, ordinal })),
    time: options.activity.elapsed,
    type: ActivityCheckpointType.Progress,
    ...(levelUp && { levelUp }),
  };
}

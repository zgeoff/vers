import type {
  Activity,
  ActivityCheckpointGenerator,
  ActivityExecutor,
  Avatar,
  SimulationContext,
} from '../types';
import { logger } from '../utils/logger';
import { buildKillRewards } from './utils/build-kill-rewards';
import { buildWaveClearRewardSlots } from './utils/build-wave-clear-reward-slots';
import { createCompletedCheckpoint } from './utils/create-completed-checkpoint';
import { createFailedCheckpoint } from './utils/create-failed-checkpoint';
import { createProgressCheckpoint } from './utils/create-progress-checkpoint';
import { createStartedCheckpoint } from './utils/create-started-checkpoint';

export function* runActivity(
  executor: ActivityExecutor,
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): ActivityCheckpointGenerator {
  const timestep = yield createStartedCheckpoint(ctx);

  logger.debug(
    () => `[activity:${activity.type}] starting activity with ${activity.waves.length} waves`,
  );

  logger.debug(
    () =>
      `[activity:${activity.type}] starting combat with first wave of ${activity.currentWave?.enemies.length} enemies`,
  );

  // xp this wave has already contributed to the activity's running total; the wave is re-summed
  // every tick, so this is what turns that cumulative sum into the tick's own delta
  let creditedWaveXP = 0;

  while (avatar.isAlive && activity.isWavesRemaining) {
    executor.run(timestep);

    const wave = activity.currentWave;

    if (wave === null) {
      yield null;
      continue;
    }

    const isWaveCleared = wave.remaining === 0;
    const rewards = buildKillRewards(wave, creditedWaveXP);

    // a tick that killed nothing is only worth a checkpoint when it cleared the wave, which owes
    // one for its reward slots even if the last enemy carried no xp
    if (rewards.xp === 0 && !isWaveCleared) {
      yield null;
      continue;
    }

    creditedWaveXP += rewards.xp;

    activity.updateRewards(rewards);

    const rewardSlotContexts = isWaveCleared
      ? buildWaveClearRewardSlots(wave, activity.difficulty)
      : [];

    const checkpoint = createProgressCheckpoint(activity, avatar, ctx, rewards, rewardSlotContexts);

    if (checkpoint.levelUp) {
      activity.setLevelUp(checkpoint.levelUp);
      avatar.updateLevel(checkpoint.levelUp.to);
    }

    yield checkpoint;

    if (isWaveCleared) {
      logger.debug(() => `[activity:${activity.type}] moving to next wave`);
      executor.reset();
      activity.advanceWave();

      creditedWaveXP = 0;
    }
  }

  if (!avatar.isAlive) {
    return createFailedCheckpoint(activity, avatar, ctx);
  }

  const completedCheckpoint = createCompletedCheckpoint(activity, avatar, ctx);

  if (completedCheckpoint.levelUp) {
    activity.setLevelUp(completedCheckpoint.levelUp);
    avatar.updateLevel(completedCheckpoint.levelUp.to);
  }

  return completedCheckpoint;
}

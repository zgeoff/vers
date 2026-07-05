import invariant from 'tiny-invariant';
import type {
  Activity,
  ActivityCheckpointGenerator,
  Avatar,
  CombatExecutor,
  SimulationContext,
} from '../types';
import { logger } from '../utils/logger';
import { createCompletedCheckpoint } from './utils/create-completed-checkpoint';
import { createFailedCheckpoint } from './utils/create-failed-checkpoint';
import { createProgressCheckpoint } from './utils/create-progress-checkpoint';
import { createStartedCheckpoint } from './utils/create-started-checkpoint';

// oxlint-disable-next-line typescript/require-await -- baseline(#236)
export async function* simulateActivity(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- executor is mutated in place via run/reset during the tick loop
  executor: CombatExecutor,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- activity is mutated in place via moveToNextEnemyGroup during the tick loop
  activity: Activity,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  avatar: Avatar,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: SimulationContext,
): ActivityCheckpointGenerator {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  invariant(activity, 'activity is required');

  const timestep = yield createStartedCheckpoint(ctx);

  const label = `[activity:${activity.type}]`;

  logger.debug(`${label} starting activity with ${activity.enemyGroups.length} enemy groups`);

  logger.debug(
    `${label} starting combat with first group of ${activity.currentEnemyGroup?.enemies.length} enemies`,
  );

  while (avatar.isAlive && activity.isEnemyGroupsRemaining) {
    executor.run(timestep);

    if (activity.currentEnemyGroup?.remaining === 0) {
      yield createProgressCheckpoint(activity, ctx);

      logger.debug(`${label} moving to next enemy group`);

      // move to the next enemy group
      executor.reset();
      activity.moveToNextEnemyGroup();
    } else {
      yield null;
    }
  }

  if (!avatar.isAlive) {
    return createFailedCheckpoint(activity, ctx);
  }

  return createCompletedCheckpoint(activity.elapsed, ctx);
}

import type { ActivityData, EnemyGroup, SimulationContext } from '../../types';
import { createEnemyGroup } from './create-enemy-group';
import { getRandomEnemyGroupCount } from './get-random-enemy-group-count';

const MIN_ENEMIES = 3;
const MAX_ENEMIES = 6;

interface ActivityConfig {
  groupCount?: number;
  groupSize?: number;
}

export function getEnemyGroups(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  activity: ActivityData,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: SimulationContext,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  config: ActivityConfig,
): Array<EnemyGroup> {
  const enemyGroupCount = config.groupCount ?? getRandomEnemyGroupCount(ctx);

  return Array.from({ length: enemyGroupCount }, () => {
    const enemyCount = config.groupSize ?? ctx.rng.getInt(MIN_ENEMIES, MAX_ENEMIES);

    return createEnemyGroup(activity, ctx, enemyCount);
  });
}

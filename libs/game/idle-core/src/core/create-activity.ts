import type {
  Activity,
  ActivityAppState,
  ActivityData,
  ActivityRewards,
  EnemyGroup,
  SimulationContext,
} from '../types';
import { getEnemyGroups } from './utils/get-enemy-groups';

interface ActivityConfig {
  readonly groupCount?: number;
  readonly groupSize?: number;
}

export function createActivity(
  data: ActivityData,
  ctx: SimulationContext,
  config: ActivityConfig = {},
): Activity {
  let elapsed = 0;
  let currentEnemyGroupIdx = 0;
  let rewards: ActivityRewards = { xp: 0 };
  const enemyGroups: Array<EnemyGroup> = getEnemyGroups(data, ctx, config);
  const isEnemyGroupsRemaining = () => enemyGroups.some((group) => group.remaining > 0);

  const moveToNextEnemyGroup = () => {
    currentEnemyGroupIdx++;
  };

  const elapseTime = (time: number) => {
    elapsed += time;
  };

  const accrueRewards = (delta: ActivityRewards) => {
    rewards = mergeRewards(rewards, delta);
  };

  const getAppState = (): ActivityAppState => {
    const currentEnemyGroup = enemyGroups[currentEnemyGroupIdx]?.getAppState() ?? null;
    const enemiesRemaining = enemyGroups.reduce((acc, group) => acc + group.remaining, 0);
    const enemyGroupsRemaining = enemyGroups.filter((group) => group.remaining > 0).length;

    return {
      currentEnemyGroup,
      elapsed,
      enemiesRemaining,
      enemyGroups: enemyGroups.map((group) => group.getAppState()),
      enemyGroupsRemaining,
      id: data.id,
      name: data.name,
      rewards,
    };
  };

  return {
    // meta
    enemyGroups,
    id: data.id,
    name: data.name,
    type: data.type,

    // getters
    get currentEnemyGroup() {
      return enemyGroups[currentEnemyGroupIdx] ?? null;
    },
    get elapsed() {
      return elapsed;
    },
    get isEnemyGroupsRemaining() {
      return isEnemyGroupsRemaining();
    },
    get rewards() {
      return rewards;
    },

    // core
    getAppState,

    // utils
    accrueRewards,
    elapseTime,
    moveToNextEnemyGroup,
  };
}

/**
 * Adds two reward maps keywise. A key an interface later adds is a mechanical addition here.
 */
function mergeRewards(base: ActivityRewards, delta: ActivityRewards): ActivityRewards {
  return { xp: base.xp + delta.xp };
}

import type {
  Activity,
  ActivityAppState,
  ActivityData,
  EnemyGroup,
  SimulationContext,
} from '../types';
import { getEnemyGroups } from './utils/get-enemy-groups';

interface ActivityConfig {
  groupCount?: number;
  groupSize?: number;
}

export function createActivity(
  data: ActivityData,
  ctx: SimulationContext,
  config: ActivityConfig = {},
): Activity {
  let elapsed = 0;
  let currentEnemyGroupIdx = 0;

  const enemyGroups: Array<EnemyGroup> = getEnemyGroups(data, ctx, config);

  const isEnemyGroupsRemaining = () => enemyGroups.some((group) => group.remaining > 0);

  const moveToNextEnemyGroup = () => {
    currentEnemyGroupIdx++;
  };

  const elapseTime = (time: number) => {
    elapsed += time;
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

    // core
    getAppState,

    // utils
    elapseTime,
    moveToNextEnemyGroup,
  };
}

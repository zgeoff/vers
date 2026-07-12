import { buildKillXP } from '../../progression';
import type { ActivityRewards, EnemyGroup } from '../../types';

export function buildGroupClearRewards(group: EnemyGroup, difficulty: number): ActivityRewards {
  const xp = group.enemies.reduce((total, enemy) => total + buildKillXP(enemy, difficulty), 0);

  return { xp };
}

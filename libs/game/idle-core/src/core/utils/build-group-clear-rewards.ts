import type { ActivityRewards, EnemyGroup } from '../../types';

export function buildGroupClearRewards(group: EnemyGroup): ActivityRewards {
  const xp = group.enemies.reduce((total, enemy) => total + enemy.xp, 0);

  return { xp };
}

import type { EnemyData } from '../types';

/**
 * Enemy kill XP scaled by a node's difficulty multiplier.
 */
export function buildKillXP(enemy: Readonly<Pick<EnemyData, 'xp'>>, difficulty: number): number {
  return Math.round(enemy.xp * difficulty);
}

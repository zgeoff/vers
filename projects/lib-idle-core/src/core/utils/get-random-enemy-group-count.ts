import type { SimulationContext } from '../../types';

const MIN_ENEMY_GROUPS = 3;
const MAX_ENEMY_GROUPS = 6;

export function getRandomEnemyGroupCount(ctx: SimulationContext): number {
  return ctx.rng.getInt(MIN_ENEMY_GROUPS, MAX_ENEMY_GROUPS);
}

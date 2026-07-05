import type { Enemy, SimulationContext } from '../../types';

export function calcEnemyAttackDamage(enemy: Enemy, ctx: SimulationContext): number {
  return ctx.rng.getInt(enemy.primaryAttack.minDamage, enemy.primaryAttack.maxDamage);
}

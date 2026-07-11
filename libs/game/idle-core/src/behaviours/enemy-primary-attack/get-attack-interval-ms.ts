import type { Enemy } from '../../types';

export function getAttackIntervalMS(entity: Enemy): number {
  return Math.round(1000 / entity.primaryAttack.speed);
}

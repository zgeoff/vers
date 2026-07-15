import type { Enemy } from '../../types';

export function hasPrimaryAttack(entity: Enemy): boolean {
  return Boolean(entity.primaryAttack);
}

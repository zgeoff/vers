import type { Enemy } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getAttackIntervalMS(entity: Enemy): number {
  return Math.round(1000 / entity.primaryAttack.speed);
}

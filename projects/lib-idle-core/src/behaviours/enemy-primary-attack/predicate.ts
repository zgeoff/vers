import type { Enemy } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function predicate(entity: Enemy): boolean {
  return Boolean(entity.primaryAttack);
}

import invariant from 'tiny-invariant';
import type { Avatar } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getAttackIntervalMS(entity: Avatar): number {
  invariant(entity.mainHandEquipment, 'no weapon equipped');

  return Math.round(1000 / entity.mainHandEquipment.speed);
}

import invariant from 'tiny-invariant';
import type { Avatar } from '../../types';

export function getAttackIntervalMS(entity: Avatar): number {
  invariant(entity.mainHandEquipment, 'no weapon equipped');

  return Math.round(1000 / entity.mainHandEquipment.speed);
}

import { PER_MILLE } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import type { Avatar } from '../../types';

export function getAttackIntervalMS(entity: Avatar): number {
  invariant(entity.mainHandEquipment, 'no weapon equipped');

  return Math.round((1000 * PER_MILLE) / entity.mainHandEquipment.speedPerMille);
}

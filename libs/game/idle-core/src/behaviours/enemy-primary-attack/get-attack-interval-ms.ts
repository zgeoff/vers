import { PER_MILLE } from '@vers/game-utils';
import type { Enemy } from '../../types';

export function getAttackIntervalMS(entity: Enemy): number {
  return Math.round((1000 * PER_MILLE) / entity.primaryAttack.speedPerMille);
}

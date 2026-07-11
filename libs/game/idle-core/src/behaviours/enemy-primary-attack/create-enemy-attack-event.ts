import { createId } from '@paralleldrive/cuid2';
import type { Enemy, EnemyAttackEvent } from '../../types';
import { CombatEventType } from '../../types';

export function createEnemyAttackEvent(entity: Enemy, time: number): EnemyAttackEvent {
  const event: EnemyAttackEvent = {
    id: createId(),
    source: entity.id,
    time,
    type: CombatEventType.EnemyAttack,
  };

  return event;
}

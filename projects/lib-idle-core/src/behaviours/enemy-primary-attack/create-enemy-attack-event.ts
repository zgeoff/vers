import { createId } from '@paralleldrive/cuid2';
import type { Enemy, EnemyAttackEvent } from '../../types';
import { CombatEventType } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createEnemyAttackEvent(entity: Enemy, time: number): EnemyAttackEvent {
  const event: EnemyAttackEvent = {
    id: createId(),
    source: entity.id,
    time,
    type: CombatEventType.EnemyAttack,
  };

  return event;
}

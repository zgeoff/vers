import { createId } from '@paralleldrive/cuid2';
import type { Avatar, AvatarAttackEvent } from '../../types';
import { CombatEventType } from '../../types';

export function createAvatarAttackEvent(entity: Avatar, time: number): AvatarAttackEvent {
  const event: AvatarAttackEvent = {
    id: createId(),
    source: entity.id,
    time,
    type: CombatEventType.AvatarAttack,
  };

  return event;
}

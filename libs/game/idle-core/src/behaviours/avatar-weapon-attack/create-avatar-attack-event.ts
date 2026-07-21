import type { Avatar, AvatarAttackEvent } from '../../types';
import { CombatEventType } from '../../types';

export function createAvatarAttackEvent(entity: Avatar, time: number): AvatarAttackEvent {
  const event: AvatarAttackEvent = {
    source: entity.id,
    time,
    type: CombatEventType.AvatarAttack,
  };

  return event;
}

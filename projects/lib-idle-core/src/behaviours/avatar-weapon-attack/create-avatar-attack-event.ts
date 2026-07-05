import { createId } from '@paralleldrive/cuid2';
import type { Avatar, AvatarAttackEvent } from '../../types';
import { CombatEventType } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createAvatarAttackEvent(entity: Avatar, time: number): AvatarAttackEvent {
  const event: AvatarAttackEvent = {
    id: createId(),
    source: entity.id,
    time,
    type: CombatEventType.AvatarAttack,
  };

  return event;
}

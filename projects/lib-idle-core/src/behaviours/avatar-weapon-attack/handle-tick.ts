import type { Avatar, AvatarWeaponAttackBehaviour, CombatExecutor } from '../../types';
import { createLogLabel } from '../../utils/create-log-label';
import { logger } from '../../utils/logger';
import { createAvatarAttackEvent } from './create-avatar-attack-event';
import { getNextAttackTime } from './get-next-attack-time';
import { isAttackReady } from './is-attack-ready';

export function handleTick(
  entity: Avatar,
  behaviour: AvatarWeaponAttackBehaviour,
  executor: CombatExecutor,
): void {
  const label = createLogLabel('avatar', entity.id);

  // loop to allow high APS to function correctly w/ server simulation batching
  while (isAttackReady(entity, behaviour.state, executor)) {
    const time = getNextAttackTime(entity, behaviour.state);
    const event = createAvatarAttackEvent(entity, time);

    executor.scheduleEvent(event);

    behaviour.setState((draft) => {
      draft.lastAttackTime = time;
    });

    logger.debug(`${label} scheduled attack at ${event.time}`);
  }
}

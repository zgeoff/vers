import type { Avatar, ScheduledCombatEvent } from '../../types';

export function createEventSorter(avatar: Avatar) {
  return (left: ScheduledCombatEvent, right: ScheduledCombatEvent) => {
    const timeDiff = left.time - right.time;

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const leftIsAvatar = left.source === avatar.id;
    const rightIsAvatar = right.source === avatar.id;

    if (leftIsAvatar !== rightIsAvatar) {
      return leftIsAvatar ? -1 : 1;
    }

    return left.sequence - right.sequence;
  };
}

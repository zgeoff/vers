import type { Avatar, ScheduledCombatEvent } from '../../types';

export function createEventSorter(avatar: Avatar) {
  return (a: ScheduledCombatEvent, b: ScheduledCombatEvent) => {
    const timeDiff = a.time - b.time;

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const aIsAvatar = a.source === avatar.id;
    const bIsAvatar = b.source === avatar.id;

    if (aIsAvatar !== bIsAvatar) {
      return aIsAvatar ? -1 : 1;
    }

    return a.sequence - b.sequence;
  };
}

import type { Avatar, CombatEvent } from '../../types';

/**
 * Orders combat events by ascending time, placing the avatar's own events before others' at the
 * same timestamp.
 */
export function createEventSorter(avatar: Avatar) {
  return (a: CombatEvent, b: CombatEvent) => {
    const timeDiff = a.time - b.time;

    if (timeDiff === 0) {
      return a.source === avatar.id ? -1 : 1;
    }

    return timeDiff;
  };
}

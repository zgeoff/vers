import type { Avatar, CombatEvent } from '../../types';

/**
 * Orders combat events by time, breaking ties in favour of the avatar's events so ties resolve
 * deterministically.
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

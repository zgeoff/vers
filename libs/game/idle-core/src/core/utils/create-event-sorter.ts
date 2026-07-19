import type { Avatar, CombatEvent } from '../../types';

/**
 * Orders combat events into a deterministic total order: ascending time, then the avatar's own
 * events before others' at an equal timestamp, then by event id so same-source ties resolve the
 * same way regardless of the order the events were scheduled in.
 */
export function createEventSorter(avatar: Avatar) {
  return (a: CombatEvent, b: CombatEvent) => {
    const timeDiff = a.time - b.time;

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const aIsAvatar = a.source === avatar.id;
    const bIsAvatar = b.source === avatar.id;

    if (aIsAvatar !== bIsAvatar) {
      return aIsAvatar ? -1 : 1;
    }

    if (a.id < b.id) {
      return -1;
    }

    if (a.id > b.id) {
      return 1;
    }

    return 0;
  };
}

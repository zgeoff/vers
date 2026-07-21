import type { Avatar, ScheduledCombatEvent } from '../../types';

/**
 * Orders combat events into a deterministic total order: ascending time, then the avatar's own
 * events before others' at an equal timestamp, then by the executor-assigned sequence number so
 * same-source ties resolve in the order the events were scheduled.
 */
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

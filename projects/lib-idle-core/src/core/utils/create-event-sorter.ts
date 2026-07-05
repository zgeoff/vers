import type { Avatar, CombatEvent } from '../../types';

// returns a fn that sorts events by time then by event source,
// preferring the avatar's events first
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createEventSorter(avatar: Avatar) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  return (a: CombatEvent, b: CombatEvent) => {
    const timeDiff = a.time - b.time;

    if (timeDiff === 0) {
      return a.source === avatar.id ? -1 : 1;
    }

    return timeDiff;
  };
}

import type { LockWaits } from './types';

const STILL_WAITING = /still waiting for (?<lock>\S+ on \S+)/u;
const ACQUIRED = /acquired (?<lock>\S+ on \S+) .*after (?<waitMs>[\d.]+) ms/u;

// postgres logs a lock wait once it passes the deadlock timeout and again when the lock is
// granted, so every wait in the log is at least that timeout long
export function parseLockWaits(log: string): LockWaits {
  const acquiredAfterMs: Array<number> = [];
  const byLock: Record<string, number> = {};
  let waits = 0;

  for (const line of log.split('\n')) {
    const waiting = STILL_WAITING.exec(line);

    if (waiting?.groups?.['lock'] !== undefined) {
      waits += 1;
      byLock[waiting.groups['lock']] = (byLock[waiting.groups['lock']] ?? 0) + 1;
      continue;
    }

    const acquired = ACQUIRED.exec(line);

    if (acquired?.groups?.['waitMs'] !== undefined) {
      acquiredAfterMs.push(Number(acquired.groups['waitMs']));
    }
  }

  return { acquiredAfterMs, byLock, waits };
}

import type { SimulationDriver } from '@vers/idle-core';

/**
 * Default cap on how many in-process streams the cache holds live at once, bounding worker
 * process memory under a large concurrent stream count.
 */
const REPLAY_CACHE_CAP = 512;

/**
 * One in-process activity's held simulation state: the live driver at the stream's verified head,
 * how many checkpoints it has emitted in total, and the hash chain's current position — the
 * coordinates a caller checks against a freshly loaded segment to tell a valid resume from a
 * stale one.
 */
interface CachedReplayStream {
  readonly driver: SimulationDriver;
  readonly emittedCount: number;
  readonly lastHash: string;
}

/**
 * An in-memory, least-recently-used cache of live in-process replay streams, keyed by activity id.
 * A `get` counts as a use and bumps the entry to most-recently-used; a `set` past `cap`, and an
 * explicit `evict`, stop the displaced entry's driver so its underlying generator cleans up
 * without waiting on GC. Never persisted — a worker restart is a cold cache, and every entry's
 * driver rebuilds lazily from the activity's `Started` snapshot on its next replay.
 */
export interface ReplayCache {
  evict: (activityID: string) => void;
  get: (activityID: string) => CachedReplayStream | undefined;
  set: (activityID: string, entry: Readonly<CachedReplayStream>) => void;
}

export function createReplayCache(cap: number = REPLAY_CACHE_CAP): ReplayCache {
  const entries = new Map<string, CachedReplayStream>();

  const evict = (activityID: string): void => {
    const entry = entries.get(activityID);

    entries.delete(activityID);
    void entry?.driver.stop();
  };

  const get = (activityID: string): CachedReplayStream | undefined => {
    const entry = entries.get(activityID);

    if (entry === undefined) {
      return undefined;
    }

    entries.delete(activityID);
    entries.set(activityID, entry);

    return entry;
  };

  const set = (activityID: string, entry: Readonly<CachedReplayStream>): void => {
    const replaced = entries.get(activityID);

    entries.delete(activityID);
    entries.set(activityID, entry);

    if (replaced !== undefined && replaced.driver !== entry.driver) {
      void replaced.driver.stop();
    }

    const oldestKey = entries.size > cap ? entries.keys().next().value : undefined;

    if (oldestKey !== undefined) {
      const oldest = entries.get(oldestKey);

      entries.delete(oldestKey);
      void oldest?.driver.stop();
    }
  };

  return { evict, get, set };
}

import type { SimulationDriver } from '@vers/idle-core';

/**
 * Default cap on how many in-process streams the cache holds live at once, bounding worker
 * process memory under a large concurrent stream count.
 */
const REPLAY_CACHE_CAP = 512;

/**
 * One in-process activity's held simulation state: the live driver at the stream's verified head,
 * how many checkpoints it has emitted in total, and the hash chain's current position — the
 * bookkeeping a test asserts to tell a cache hit from a rebuild.
 */
interface CachedReplayStream {
  readonly driver: SimulationDriver;
  readonly emittedCount: number;
  readonly lastHash: string;
}

/**
 * An in-memory, least-recently-used cache of live in-process replay streams, keyed by activity id.
 * A `get` counts as a use and bumps the entry to most-recently-used; a `set` past `cap` evicts the
 * least-recently-used entry. Never persisted — a worker restart is a cold cache, and every entry's
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
    entries.delete(activityID);
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
    entries.delete(activityID);
    entries.set(activityID, entry);

    const oldestKey = entries.size > cap ? entries.keys().next().value : undefined;

    if (oldestKey !== undefined) {
      entries.delete(oldestKey);
    }
  };

  return { evict, get, set };
}

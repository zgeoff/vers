import type { SimulationDriver } from '@vers/idle-core';
import { LRUCache } from 'lru-cache';

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
 * explicit `remove`, stop the displaced entry's driver so its underlying generator cleans up
 * without waiting on GC. `stopAll` empties the cache and stops every entry still held, so a caller
 * done with the cache leaves no live driver behind. Never persisted — a worker restart is a cold
 * cache, and every entry's driver rebuilds lazily from the activity's `Started` snapshot on its
 * next replay.
 */
export interface ReplayCache {
  get: (activityID: string) => CachedReplayStream | undefined;
  remove: (activityID: string) => void;
  set: (activityID: string, entry: Readonly<CachedReplayStream>) => void;
  stopAll: () => void;
}

/**
 * `onStopError` receives the driver-stop rejection of any entry the cache lets go — removed,
 * replaced, or evicted past the cap — which otherwise dies as an unhandled rejection; it defaults
 * to `console.error` so a failed cleanup is never silent. A throw from the callback itself falls
 * back to `console.error` rather than escaping.
 */
export function createReplayCache(
  cap: number = REPLAY_CACHE_CAP,
  onStopError: (error: unknown) => void = printDriverStopError,
): ReplayCache {
  const stopDriver = async (driver: SimulationDriver): Promise<void> => {
    try {
      await driver.stop();
    } catch (error) {
      try {
        onStopError(error);
      } catch {
        printDriverStopError(error);
      }
    }
  };

  // Replacement is excluded here: a re-set entry may reuse the displaced entry's driver, so the
  // set path below decides whether the old driver actually stops.
  const entries = new LRUCache<string, CachedReplayStream>({
    dispose: (entry, _activityID, reason) => {
      if (reason !== 'set') {
        void stopDriver(entry.driver);
      }
    },
    max: cap,
  });

  const set = (activityID: string, entry: Readonly<CachedReplayStream>): void => {
    const replaced = entries.peek(activityID);

    entries.set(activityID, entry);

    if (replaced !== undefined && replaced.driver !== entry.driver) {
      void stopDriver(replaced.driver);
    }
  };

  return {
    get: (activityID) => entries.get(activityID),
    remove: (activityID) => {
      entries.delete(activityID);
    },
    set,
    stopAll: () => {
      entries.clear();
    },
  };
}

function printDriverStopError(error: unknown): void {
  console.error('[service-replay] replay cache driver stop failed', error);
}

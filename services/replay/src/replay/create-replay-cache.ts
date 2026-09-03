import type { SimulationDriver } from '@vers/idle-core';
import { LRUCache } from 'lru-cache';

const REPLAY_CACHE_CAP = 512;

interface CachedReplayStream {
  readonly driver: SimulationDriver;
  readonly emittedCount: number;
  readonly lastHash: string;
}

export interface ReplayCache {
  get: (activityID: string) => CachedReplayStream | undefined;
  remove: (activityID: string) => void;
  set: (activityID: string, entry: Readonly<CachedReplayStream>) => void;
  stopAll: () => void;
}

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

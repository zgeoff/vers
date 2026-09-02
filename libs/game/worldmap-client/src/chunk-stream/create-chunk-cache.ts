import { LRUMap } from '../utils/lru-map';

export interface CreateChunkCacheOptions<TEntry> {
  readonly capacity: number;

  readonly dispose: (entry: TEntry) => void;
}

export interface ChunkCache<TEntry> {
  readonly clear: () => void;
  readonly get: (key: string) => TEntry | undefined;
  readonly has: (key: string) => boolean;
  readonly isSyncedTo: (userSeed: number) => boolean;
  readonly set: (key: string, entry: TEntry) => void;
  readonly size: number;
  readonly syncSeed: (userSeed: number) => void;
}

export function createChunkCache<TEntry>(
  options: Readonly<CreateChunkCacheOptions<TEntry>>,
): ChunkCache<TEntry> {
  const map = new LRUMap<string, TEntry>(options.capacity, options.dispose);

  let syncedSeed: number | null = null;

  return {
    get size() {
      return map.size;
    },

    clear: () => {
      map.clear();
    },

    get: (key) => map.get(key),

    has: (key) => map.has(key),

    isSyncedTo: (userSeed) => syncedSeed === userSeed,

    set: (key, entry) => {
      map.set(key, entry);
    },

    syncSeed: (userSeed) => {
      if (syncedSeed === userSeed) {
        return;
      }

      syncedSeed = userSeed;

      map.clear();
    },
  };
}

import { LRUMap } from '../utils/lru-map';

export interface CreateChunkCacheOptions<TEntry> {
  /**
   * Cached entries kept before evicting the least-recently-used one — the bound that keeps a long
   * free pan from growing the cache's GPU resources without limit.
   */
  readonly capacity: number;

  /**
   * Releases whatever resources an entry holds. Called for an entry evicted past capacity and for
   * every entry a seed change clears, never for an entry a fresh `set` overwrites in place.
   */
  readonly dispose: (entry: TEntry) => void;
}

/**
 * A chunk-keyed store for one streamed content layer's built entries.
 */
export interface ChunkCache<TEntry> {
  readonly clear: () => void;
  readonly get: (key: string) => TEntry | undefined;
  readonly has: (key: string) => boolean;
  readonly set: (key: string, entry: TEntry) => void;
  readonly size: number;
  readonly syncSeed: (userSeed: number) => void;
}

/**
 * Builds a chunk-keyed cache for one streamed content layer, generic over the entry shape so a
 * relief or scatter layer can cache its own richer entry type without reworking the cache itself.
 * Capacity-bounded and least-recently-used evicted via `LRUMap`, disposing an evicted entry through
 * `options.dispose`.
 *
 * `syncSeed` additionally clears the whole cache — disposing every entry — the first time it sees a
 * seed other than the one it last synced: a cached entry's content is derived from the seed that
 * built it, and a chunk coordinate never carries that seed in its key, so a seed change would
 * otherwise resolve stale content at every coordinate. `clear` exposes the same disposal for a
 * caller that owns the cache's whole lifetime, such as an unmounting consumer releasing every
 * entry it still holds.
 */
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

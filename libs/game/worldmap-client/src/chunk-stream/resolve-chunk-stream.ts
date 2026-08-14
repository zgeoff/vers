import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { buildChunkKey } from './build-chunk-key';
import type { ChunkCache } from './create-chunk-cache';

/**
 * Chunk indices past these hold cells outside the world coordinate range, so the prefetch strip
 * stops here rather than queuing a chunk whose cells can never generate.
 */
const MIN_WORLD_CHUNK = Math.floor(WORLD_COORD_MIN / CHUNK_SIZE);
const MAX_WORLD_CHUNK = Math.floor(WORLD_COORD_MAX / CHUNK_SIZE);

export interface ChunkRange {
  readonly maxChunkX: number;
  readonly maxChunkY: number;
  readonly minChunkX: number;
  readonly minChunkY: number;
}

export interface ResolveChunkStreamResult<TEntry> {
  readonly entries: ReadonlyArray<TEntry>;
  readonly misses: ReadonlyArray<string>;
  readonly range: ChunkRange;
}

/**
 * Resolves the chunk entries a chunk-aligned viewport currently finds cached, plus the chunk keys
 * still missing — the viewport's own uncached chunks first, then, once `previousRange` shows the
 * range moved, the strip one chunk beyond the edge the pan is heading toward, so terrain exists
 * before the pan arrives. Purely a function of the cache's current contents and the two ranges: it
 * builds nothing itself, so a caller drives progressive filling by handing each returned miss to
 * the cache in a later tick and resolving again — the mutable-cache read this performs on every
 * call is what lets that later resolve see chunks a previous tick built, never a memo staled
 * against the cache.
 */
export function resolveChunkStream<TEntry>(
  cache: Readonly<ChunkCache<TEntry>>,
  viewport: Readonly<Viewport>,
  previousRange: Readonly<ChunkRange> | null,
): ResolveChunkStreamResult<TEntry> {
  const range: ChunkRange = {
    maxChunkX: Math.floor(viewport.maxCX / CHUNK_SIZE),
    maxChunkY: Math.floor(viewport.maxCY / CHUNK_SIZE),
    minChunkX: Math.floor(viewport.minCX / CHUNK_SIZE),
    minChunkY: Math.floor(viewport.minCY / CHUNK_SIZE),
  };

  const entries: Array<TEntry> = [];
  const misses: Array<string> = [];

  for (let chunkY = range.minChunkY; chunkY <= range.maxChunkY; chunkY++) {
    for (let chunkX = range.minChunkX; chunkX <= range.maxChunkX; chunkX++) {
      const key = buildChunkKey(chunkX, chunkY);
      const entry = cache.get(key);

      if (entry === undefined) {
        misses.push(key);
      } else {
        entries.push(entry);
      }
    }
  }

  if (previousRange !== null) {
    misses.push(...collectLeadingEdgeMisses(cache, range, previousRange));
  }

  return { entries, misses, range };
}

/**
 * Reads the cached entries a chunk-aligned viewport currently covers, refreshing each hit's recency
 * but building and queuing nothing. This is the read a render performs to show whatever the cache
 * already holds, leaving every write — seed invalidation, miss queuing, the range the prefetch
 * compares against — to a committed effect, so an abandoned concurrent render never disposes or
 * queues against state the committed scene still depends on.
 */
export function collectCachedEntries<TEntry>(
  cache: Readonly<ChunkCache<TEntry>>,
  viewport: Readonly<Viewport>,
): ReadonlyArray<TEntry> {
  const entries: Array<TEntry> = [];
  const minChunkY = Math.floor(viewport.minCY / CHUNK_SIZE);
  const maxChunkY = Math.floor(viewport.maxCY / CHUNK_SIZE);
  const minChunkX = Math.floor(viewport.minCX / CHUNK_SIZE);
  const maxChunkX = Math.floor(viewport.maxCX / CHUNK_SIZE);

  for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      const entry = cache.get(buildChunkKey(chunkX, chunkY));

      if (entry !== undefined) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

/**
 * Collects the chunk strip one step beyond whichever edge the range advanced past since
 * `previousRange`, per axis, skipping a chunk the main scan above already queued. The range's own
 * minimum corner is the movement signal: a genuine pan holds the range's span constant while both
 * corners shift together, so a change on the minimum alone unambiguously names the direction: a
 * span change with no shift (a zoom) reports no movement on that axis and collects no strip, since
 * the zoom's own newly visible area already came from the main scan above.
 */
function collectLeadingEdgeMisses<TEntry>(
  cache: Readonly<ChunkCache<TEntry>>,
  range: Readonly<ChunkRange>,
  previousRange: Readonly<ChunkRange>,
): Array<string> {
  const misses: Array<string> = [];
  const movedX = Math.sign(range.minChunkX - previousRange.minChunkX);
  const movedY = Math.sign(range.minChunkY - previousRange.minChunkY);

  if (movedX !== 0) {
    const edgeX = movedX > 0 ? range.maxChunkX + 1 : range.minChunkX - 1;

    if (edgeX >= MIN_WORLD_CHUNK && edgeX <= MAX_WORLD_CHUNK) {
      for (let chunkY = range.minChunkY; chunkY <= range.maxChunkY; chunkY++) {
        const key = buildChunkKey(edgeX, chunkY);

        // resolve through `get`, not `has`, so an already-cached prefetch chunk refreshes its
        // recency and survives eviction until the pan that queued it arrives
        if (cache.get(key) === undefined) {
          misses.push(key);
        }
      }
    }
  }

  if (movedY !== 0) {
    const edgeY = movedY > 0 ? range.maxChunkY + 1 : range.minChunkY - 1;

    if (edgeY >= MIN_WORLD_CHUNK && edgeY <= MAX_WORLD_CHUNK) {
      for (let chunkX = range.minChunkX; chunkX <= range.maxChunkX; chunkX++) {
        const key = buildChunkKey(chunkX, edgeY);

        if (cache.get(key) === undefined) {
          misses.push(key);
        }
      }
    }
  }

  return misses;
}

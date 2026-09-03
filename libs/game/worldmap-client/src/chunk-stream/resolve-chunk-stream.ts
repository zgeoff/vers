import type { Viewport } from '@vers/worldmap-core';
import { CHUNK_SIZE, WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { buildChunkKey } from './build-chunk-key';
import type { ChunkCache } from './create-chunk-cache';

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

function collectLeadingEdgeMisses<TEntry>(
  cache: Readonly<ChunkCache<TEntry>>,
  range: Readonly<ChunkRange>,
  previousRange: Readonly<ChunkRange>,
): Array<string> {
  const misses: Array<string> = [];

  // the minimum corner is the movement signal: a pan shifts both corners together, while a zoom
  // that changes only the span reports no movement and collects no strip, since its newly visible
  // area already came from the main scan above
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

import type { Viewport } from '@vers/worldmap-core';
import { useDeferredValue, useEffect, useReducer, useRef } from 'react';
import { createChunkCache } from './create-chunk-cache';
import { parseChunkKey } from './parse-chunk-key';
import type { ChunkRange } from './resolve-chunk-stream';
import { collectCachedEntries, resolveChunkStream } from './resolve-chunk-stream';

export interface UseChunkStreamOptions<TEntry> {
  readonly build: (userSeed: number, chunkX: number, chunkY: number) => TEntry;

  readonly cacheCapacity: number;

  readonly dispose: (entry: TEntry) => void;

  readonly onBuildTick?: (buildMs: number, builtChunkCount: number) => void;

  readonly userSeed: number | null;

  readonly viewport: Viewport | null;
}

const BUILDS_PER_TICK = 1;

export function useChunkStream<TEntry>(
  options: Readonly<UseChunkStreamOptions<TEntry>>,
): ReadonlyArray<TEntry> {
  const deferredViewport = useDeferredValue(options.viewport);
  const cacheRef = useRef<ReturnType<typeof createChunkCache<TEntry>> | null>(null);
  const previousRangeRef = useRef<ChunkRange | null>(null);
  const pendingRef = useRef<ReadonlyArray<string>>([]);
  const [, forceUpdate] = useReducer((tick: number) => tick + 1, 0);

  cacheRef.current ??= createChunkCache<TEntry>({
    capacity: options.cacheCapacity,
    dispose: options.dispose,
  });

  const cache = cacheRef.current;
  const userSeed = options.userSeed;

  useEffect(
    () => () => {
      cache.clear();
    },
    [cache],
  );

  // committed write pass: invalidate the cache when the seed changes, then record the range and the
  // miss queue the builder drains. Deferred to an effect so neither a discarded concurrent render
  // nor development's double-invoked render body ever runs these writes.
  useEffect(() => {
    if (userSeed === null || deferredViewport === null) {
      pendingRef.current = [];

      return;
    }

    cache.syncSeed(userSeed);

    const resolved = resolveChunkStream(cache, deferredViewport, previousRangeRef.current);

    previousRangeRef.current = resolved.range;
    pendingRef.current = resolved.misses;

    // surface any chunks already cached for this viewport, and kick the builder for the misses
    forceUpdate();
  }, [cache, userSeed, deferredViewport]);

  const entries =
    userSeed !== null && deferredViewport !== null && cache.isSyncedTo(userSeed)
      ? collectCachedEntries(cache, deferredViewport)
      : [];

  useEffect(() => {
    if (userSeed === null || pendingRef.current.length === 0) {
      return () => {};
    }

    let cancelled = false;

    const advanceBuildQueue = () => {
      if (cancelled || pendingRef.current.length === 0) {
        return;
      }

      const batch = pendingRef.current.slice(0, BUILDS_PER_TICK);

      pendingRef.current = pendingRef.current.slice(BUILDS_PER_TICK);

      const startedAt = performance.now();
      let builtChunkCount = 0;

      for (const key of batch) {
        if (cache.has(key)) {
          continue;
        }

        const [chunkX, chunkY] = parseChunkKey(key);

        cache.set(key, options.build(userSeed, chunkX, chunkY));

        builtChunkCount += 1;
      }

      options.onBuildTick?.(performance.now() - startedAt, builtChunkCount);

      // schedules the render that surfaces this tick's builds; the effect above re-derives
      // `pendingRef.current` from that render's own resolve, so an emptied queue here is never
      // stale against work a viewport change queued in the meantime
      forceUpdate();

      if (pendingRef.current.length > 0) {
        requestAnimationFrame(advanceBuildQueue);
      }
    };

    const frame = requestAnimationFrame(advanceBuildQueue);

    return () => {
      cancelled = true;

      cancelAnimationFrame(frame);
    };

    // no dependency array: runs after every render and exits immediately once nothing is pending,
    // so the progressive builder always drains the render body's latest queue and never strands
    // itself on a stale closure
  });

  return entries;
}

import type { Viewport } from '@vers/worldmap-core';
import { useDeferredValue, useEffect, useReducer, useRef } from 'react';
import { createChunkCache } from './create-chunk-cache';
import { parseChunkKey } from './parse-chunk-key';
import type { ChunkRange } from './resolve-chunk-stream';
import { collectCachedEntries, resolveChunkStream } from './resolve-chunk-stream';

export interface UseChunkStreamOptions<TEntry> {
  /**
   * Builds one chunk's entry from the seed and its coordinate. Only ever called with the seed
   * `userSeed` currently holds — a miss never reaches this while `userSeed` is `null`.
   */
  readonly build: (userSeed: number, chunkX: number, chunkY: number) => TEntry;

  readonly cacheCapacity: number;

  /**
   * Releases an entry's resources. Called for an entry evicted past capacity, for every entry a
   * seed change drops, and for every entry still cached when the hook unmounts.
   */
  readonly dispose: (entry: TEntry) => void;

  /**
   * Reports one progressive-build tick's wall time and how many chunks it built, for the caller to
   * fold into its own perf telemetry.
   */
  readonly onBuildTick?: (buildMs: number, builtChunkCount: number) => void;

  readonly userSeed: number | null;

  /**
   * A chunk-aligned viewport — `buildChunkAlignedViewport`'s output, or `null` before one exists.
   */
  readonly viewport: Viewport | null;
}

/**
 * Chunk builds allowed per animation frame. Bounding it to the single biggest build a frame can
 * absorb is what keeps a pan interruptible: a multi-chunk batch on one frame reintroduces the
 * synchronous stall this hook exists to remove, while still draining a large miss set within a
 * handful of frames.
 */
const BUILDS_PER_TICK = 1;

/**
 * Streams a chunk-keyed content layer over a chunk-aligned viewport: cached chunks resolve
 * instantly on every render, a bounded number of misses build per animation frame so a pan never
 * stalls, and the strip one chunk beyond the pan's leading edge prefetches ahead of the viewport
 * that will need it. `viewport` is wrapped in `useDeferredValue` here, once, so every layer this
 * hook drives gets an interruptible transition on a chunk-crossing pan without wrapping it itself.
 *
 * The render body only reads the cache — it shows whatever chunks are already built and touches no
 * shared state, so a concurrent render React starts and abandons never disposes or queues against
 * the committed scene. Every write — invalidating the cache on a seed change, recording the range
 * the prefetch compares against, queuing the misses to build — happens in a committed effect, which
 * also keeps the predictive prefetch working under React's development double-render. Newly built
 * chunks reach the returned array through the progressive builder's own re-renders: a memo keyed on
 * the viewport would never observe a build that lands without the viewport changing.
 */
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

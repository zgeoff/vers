import { expect, test } from 'bun:test';
import { createChunkCache } from './create-chunk-cache';
import type { ChunkRange } from './resolve-chunk-stream';
import { resolveChunkStream } from './resolve-chunk-stream';

// two chunks wide (chunk x 0 and 1), one chunk tall (chunk y 0)
const TWO_CHUNK_VIEWPORT = { maxCX: 31, maxCY: 15, minCX: 0, minCY: 0 };

test('it reports every chunk the viewport covers as a miss when the cache is empty', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });
  const resolved = resolveChunkStream(cache, TWO_CHUNK_VIEWPORT, null);

  expect(resolved.entries).toHaveLength(0);
  expect(resolved.misses).toIncludeSameMembers(['0_0', '1_0']);
  expect(resolved.range).toStrictEqual({ maxChunkX: 1, maxChunkY: 0, minChunkX: 0, minChunkY: 0 });
});

test('it resolves a cached chunk as an entry and drops it from the misses', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  cache.set('0_0', 'tile-0-0');

  const resolved = resolveChunkStream(cache, TWO_CHUNK_VIEWPORT, null);

  expect(resolved.entries).toStrictEqual(['tile-0-0']);
  expect(resolved.misses).toStrictEqual(['1_0']);
});

test('it queues no leading-edge strip on the first resolve, with no previous range', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });
  const resolved = resolveChunkStream(cache, TWO_CHUNK_VIEWPORT, null);

  expect(resolved.misses).toIncludeSameMembers(['0_0', '1_0']);
});

test('it queues no leading-edge strip when the range is unchanged from the previous resolve', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  cache.set('0_0', 'tile-0-0');
  cache.set('1_0', 'tile-1-0');

  const previousRange: ChunkRange = { maxChunkX: 1, maxChunkY: 0, minChunkX: 0, minChunkY: 0 };
  const resolved = resolveChunkStream(cache, TWO_CHUNK_VIEWPORT, previousRange);

  expect(resolved.misses).toHaveLength(0);
});

test('it queues the strip beyond the max-x edge when the range advanced in the positive x direction', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  // chunks 1 and 2 (previously 0 and 1), already cached so only the prefetch strip should surface
  cache.set('1_0', 'tile-1-0');
  cache.set('2_0', 'tile-2-0');

  const previousRange: ChunkRange = { maxChunkX: 1, maxChunkY: 0, minChunkX: 0, minChunkY: 0 };

  const resolved = resolveChunkStream(
    cache,
    { maxCX: 47, maxCY: 15, minCX: 16, minCY: 0 },
    previousRange,
  );

  expect(resolved.misses).toStrictEqual(['3_0']);
});

test('it queues the strip beyond the min-x edge when the range retreated in the negative x direction', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  cache.set('0_0', 'tile-0-0');
  cache.set('1_0', 'tile-1-0');

  const previousRange: ChunkRange = { maxChunkX: 2, maxChunkY: 0, minChunkX: 1, minChunkY: 0 };
  const resolved = resolveChunkStream(cache, TWO_CHUNK_VIEWPORT, previousRange);

  expect(resolved.misses).toStrictEqual(['-1_0']);
});

test('it queues the strip beyond the min-y edge when the range retreated in the negative y direction', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  cache.set('0_0', 'tile-0-0');

  const previousRange: ChunkRange = { maxChunkX: 0, maxChunkY: 1, minChunkX: 0, minChunkY: 1 };

  const resolved = resolveChunkStream(
    cache,
    { maxCX: 15, maxCY: 15, minCX: 0, minCY: 0 },
    previousRange,
  );

  expect(resolved.misses).toStrictEqual(['0_-1']);
});

test('it never re-queues a leading-edge chunk the cache already holds', () => {
  const cache = createChunkCache<string>({ capacity: 8, dispose: () => {} });

  cache.set('1_0', 'tile-1-0');
  cache.set('2_0', 'tile-2-0');
  cache.set('3_0', 'tile-3-0');

  const previousRange: ChunkRange = { maxChunkX: 1, maxChunkY: 0, minChunkX: 0, minChunkY: 0 };

  const resolved = resolveChunkStream(
    cache,
    { maxCX: 47, maxCY: 15, minCX: 16, minCY: 0 },
    previousRange,
  );

  expect(resolved.misses).toHaveLength(0);
});

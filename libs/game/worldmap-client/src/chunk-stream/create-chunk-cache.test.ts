import { expect, test } from 'bun:test';
import { createChunkCache } from './create-chunk-cache';

test('it returns undefined for a coordinate never set', () => {
  const cache = createChunkCache<string>({ capacity: 4, dispose: () => {} });

  expect(cache.get('0_0')).toBeUndefined();
  expect(cache.has('0_0')).toBeFalse();
});

test('it returns a set entry by its key', () => {
  const cache = createChunkCache<string>({ capacity: 4, dispose: () => {} });

  cache.set('0_0', 'tile');

  expect(cache.get('0_0')).toBe('tile');
  expect(cache.has('0_0')).toBeTrue();
});

test('it disposes the least-recently-used entry once a set passes capacity', () => {
  const disposed: Array<string> = [];

  const cache = createChunkCache<string>({
    capacity: 2,
    dispose: (entry) => {
      disposed.push(entry);
    },
  });

  cache.set('0_0', 'a');
  cache.set('1_0', 'b');
  cache.set('2_0', 'c');

  expect(disposed).toStrictEqual(['a']);
  expect(cache.has('0_0')).toBeFalse();
  expect(cache.has('1_0')).toBeTrue();
  expect(cache.has('2_0')).toBeTrue();
});

test('it spares a recently read entry from eviction', () => {
  const disposed: Array<string> = [];

  const cache = createChunkCache<string>({
    capacity: 2,
    dispose: (entry) => {
      disposed.push(entry);
    },
  });

  cache.set('0_0', 'a');
  cache.set('1_0', 'b');
  cache.get('0_0');
  cache.set('2_0', 'c');

  expect(disposed).toStrictEqual(['b']);
  expect(cache.has('0_0')).toBeTrue();
});

test('it disposes every entry and clears the cache the first time syncSeed sees a new seed', () => {
  const disposed: Array<string> = [];

  const cache = createChunkCache<string>({
    capacity: 4,
    dispose: (entry) => {
      disposed.push(entry);
    },
  });

  cache.set('0_0', 'a');
  cache.set('1_0', 'b');
  cache.syncSeed(42);

  expect(disposed).toIncludeSameMembers(['a', 'b']);
  expect(cache.size).toBe(0);
});

test('it leaves the cache untouched when syncSeed repeats the already-synced seed', () => {
  const disposed: Array<string> = [];

  const cache = createChunkCache<string>({
    capacity: 4,
    dispose: (entry) => {
      disposed.push(entry);
    },
  });

  cache.syncSeed(42);
  cache.set('0_0', 'a');
  cache.syncSeed(42);

  expect(disposed).toHaveLength(0);
  expect(cache.get('0_0')).toBe('a');
});

test('it disposes every remaining entry on clear', () => {
  const disposed: Array<string> = [];

  const cache = createChunkCache<string>({
    capacity: 4,
    dispose: (entry) => {
      disposed.push(entry);
    },
  });

  cache.set('0_0', 'a');
  cache.set('1_0', 'b');
  cache.clear();

  expect(disposed).toIncludeSameMembers(['a', 'b']);
  expect(cache.size).toBe(0);
});

import { expect, test } from 'bun:test';
import type { SimulationDriver } from '@vers/idle-core';
import { createReplayCache } from './create-replay-cache';

function buildFakeDriver(): SimulationDriver {
  return {
    advanceToDuration: () => Promise.resolve([]),
    elapsed: 0,
    rngState: '',
    stop: () => Promise.resolve(),
  };
}

test('it returns undefined for an activity that was never cached', () => {
  const cache = createReplayCache();

  expect(cache.get('act_missing')).toBeUndefined();
});

test('it returns what was set for a cached activity', () => {
  const cache = createReplayCache();
  const entry = { driver: buildFakeDriver(), emittedCount: 5, lastHash: 'hash-5' };

  cache.set('act_1', entry);

  expect(cache.get('act_1')).toStrictEqual(entry);
});

test('it drops an evicted activity', () => {
  const cache = createReplayCache();

  cache.set('act_1', { driver: buildFakeDriver(), emittedCount: 1, lastHash: 'hash-1' });
  cache.evict('act_1');

  expect(cache.get('act_1')).toBeUndefined();
});

test('it evicts the least-recently-used entry once the cap is exceeded', () => {
  const cache = createReplayCache(2);

  cache.set('act_1', { driver: buildFakeDriver(), emittedCount: 1, lastHash: 'hash-1' });
  cache.set('act_2', { driver: buildFakeDriver(), emittedCount: 2, lastHash: 'hash-2' });
  cache.set('act_3', { driver: buildFakeDriver(), emittedCount: 3, lastHash: 'hash-3' });

  expect(cache.get('act_1')).toBeUndefined();
  expect(cache.get('act_2')).toBeDefined();
  expect(cache.get('act_3')).toBeDefined();
});

test('it treats a get as a use, sparing a recently read entry from eviction', () => {
  const cache = createReplayCache(2);

  cache.set('act_1', { driver: buildFakeDriver(), emittedCount: 1, lastHash: 'hash-1' });
  cache.set('act_2', { driver: buildFakeDriver(), emittedCount: 2, lastHash: 'hash-2' });
  cache.get('act_1');
  cache.set('act_3', { driver: buildFakeDriver(), emittedCount: 3, lastHash: 'hash-3' });

  expect(cache.get('act_1')).toBeDefined();
  expect(cache.get('act_2')).toBeUndefined();
  expect(cache.get('act_3')).toBeDefined();
});

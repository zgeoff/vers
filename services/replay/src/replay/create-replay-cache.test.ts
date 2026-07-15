import { expect, mock, test } from 'bun:test';
import type { SimulationDriver } from '@vers/idle-core';
import { createReplayCache } from './create-replay-cache';

function buildFakeDriver(): SimulationDriver {
  return {
    advanceToDuration: () => Promise.resolve({ checkpoints: [], haltedOnDurationCap: false }),
    elapsed: 0,
    rngState: '',
    stop: mock(() => Promise.resolve()),
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

test('it drops an evicted activity and stops its driver', () => {
  const cache = createReplayCache();
  const entry = { driver: buildFakeDriver(), emittedCount: 1, lastHash: 'hash-1' };

  cache.set('act_1', entry);
  cache.remove('act_1');

  expect(cache.get('act_1')).toBeUndefined();
  expect(entry.driver.stop).toHaveBeenCalledOnce();
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

test('it stops the cap-evicted entry driver', () => {
  const cache = createReplayCache(1);
  const first = { driver: buildFakeDriver(), emittedCount: 1, lastHash: 'hash-1' };

  cache.set('act_1', first);
  cache.set('act_2', { driver: buildFakeDriver(), emittedCount: 2, lastHash: 'hash-2' });

  expect(first.driver.stop).toHaveBeenCalledOnce();
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

test('it does not stop a re-set entry that reuses the same driver', () => {
  const cache = createReplayCache();
  const driver = buildFakeDriver();

  cache.set('act_1', { driver, emittedCount: 1, lastHash: 'hash-1' });
  cache.set('act_1', { driver, emittedCount: 2, lastHash: 'hash-2' });

  expect(driver.stop).not.toHaveBeenCalled();
});

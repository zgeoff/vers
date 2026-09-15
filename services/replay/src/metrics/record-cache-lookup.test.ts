import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordCacheLookup } from './record-cache-lookup';

test('it counts each lookup by what it found', async () => {
  const inMemory = createInMemoryMetrics();

  recordCacheLookup('hit');
  recordCacheLookup('hit');
  recordCacheLookup('miss');
  recordCacheLookup('stale');

  const points = await inMemory.readCounterDataPoints('vers.replay.cache_lookups');

  expect(points).toIncludeSameMembers([
    { attributes: { outcome: 'hit' }, value: 2 },
    { attributes: { outcome: 'miss' }, value: 1 },
    { attributes: { outcome: 'stale' }, value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordCacheLookup('hit');
  }).not.toThrow();
});

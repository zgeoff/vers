import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordPoolReset } from './record-pool-reset';

test('it counts each pool reset by reason', () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordPoolReset('resume');
  recordPoolReset('query_stall');
  recordPoolReset('query_stall');

  expect(
    inMemoryMetrics.readCounterDataPoints('vers.db.pool_resets'),
  ).resolves.toIncludeSameMembers([
    { attributes: { reason: 'resume' }, value: 1 },
    { attributes: { reason: 'query_stall' }, value: 2 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordPoolReset('resume');
  }).not.toThrow();
});

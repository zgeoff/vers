import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordPoolReset } from './record-pool-reset';

test('it counts each pool reset', () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordPoolReset();
  recordPoolReset();

  expect(inMemoryMetrics.readCounterValue('vers.db.pool_resets')).resolves.toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordPoolReset();
  }).not.toThrow();
});

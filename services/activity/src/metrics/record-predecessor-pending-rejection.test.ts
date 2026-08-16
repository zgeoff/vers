import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordPredecessorPendingRejection } from './record-predecessor-pending-rejection';

test('it counts each predecessor-pending rejection', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordPredecessorPendingRejection();
  recordPredecessorPendingRejection();

  const rejections = await inMemoryMetrics.readCounterValue(
    'vers.activity.predecessor_pending_rejections',
  );

  expect(rejections).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordPredecessorPendingRejection();
  }).not.toThrow();
});

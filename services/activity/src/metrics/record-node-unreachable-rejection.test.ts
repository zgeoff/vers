import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordNodeUnreachableRejection } from './record-node-unreachable-rejection';

test('it counts each node-unreachable rejection', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordNodeUnreachableRejection();
  recordNodeUnreachableRejection();

  const rejections = await inMemoryMetrics.readCounterValue(
    'vers.activity.node_unreachable_rejections',
  );

  expect(rejections).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordNodeUnreachableRejection();
  }).not.toThrow();
});

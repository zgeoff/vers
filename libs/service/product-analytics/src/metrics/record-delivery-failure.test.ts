import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordDeliveryFailure } from './record-delivery-failure';

test('it counts delivery failures by reason', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordDeliveryFailure('rejected');
  recordDeliveryFailure('rejected');
  recordDeliveryFailure('quarantined');
  recordDeliveryFailure('unreachable');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints(
    'vers.analytics.delivery_failures',
  );

  const observed = dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'rejected', value: 2 },
    { reason: 'quarantined', value: 1 },
    { reason: 'unreachable', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordDeliveryFailure('rejected');
  }).not.toThrow();
});

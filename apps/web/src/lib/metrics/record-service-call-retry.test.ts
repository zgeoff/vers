import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordServiceCallRetry } from './record-service-call-retry';

test('it counts retry attempts by service', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordServiceCallRetry('avatar');
  recordServiceCallRetry('avatar');
  recordServiceCallRetry('activity');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.web.service_call_retries');

  const observed = dataPoints.map((dataPoint) => ({
    service: dataPoint.attributes['service'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { service: 'avatar', value: 2 },
    { service: 'activity', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordServiceCallRetry('avatar');
  }).not.toThrow();
});

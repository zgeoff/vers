import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordServiceCallFailure } from './record-service-call-failure';

test('it counts service call failures by service and reason', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordServiceCallFailure('avatar', 'timeout');
  recordServiceCallFailure('avatar', 'timeout');
  recordServiceCallFailure('avatar', 'transport');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.web.service_call_failures');

  const observed = dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    service: dataPoint.attributes['service'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'timeout', service: 'avatar', value: 2 },
    { reason: 'transport', service: 'avatar', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordServiceCallFailure('avatar', 'timeout');
  }).not.toThrow();
});

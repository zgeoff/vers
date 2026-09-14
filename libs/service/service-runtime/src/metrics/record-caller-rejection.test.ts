import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordCallerRejection } from './record-caller-rejection';

test('it counts caller rejections by issuer and service', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordCallerRejection({ issuer: 'app-web', service: 'service-keys' });
  recordCallerRejection({ issuer: 'app-web', service: 'service-keys' });
  recordCallerRejection({ issuer: 'service-replay', service: 'service-activity' });

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.service.caller_rejections');

  const observed = dataPoints.map((dataPoint) => ({
    issuer: dataPoint.attributes['issuer'],
    service: dataPoint.attributes['service'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { issuer: 'app-web', service: 'service-keys', value: 2 },
    { issuer: 'service-replay', service: 'service-activity', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordCallerRejection({ issuer: 'app-web', service: 'service-keys' });
  }).not.toThrow();
});

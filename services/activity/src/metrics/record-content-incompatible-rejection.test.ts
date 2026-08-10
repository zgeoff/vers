import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordContentIncompatibleRejection } from './record-content-incompatible-rejection';

test('it counts rejections by path', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordContentIncompatibleRejection('requested');
  recordContentIncompatibleRejection('requested');
  recordContentIncompatibleRejection('fallback');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints(
    'vers.activity.content_incompatible_rejections',
  );

  const observed = dataPoints.map((dataPoint) => ({
    path: dataPoint.attributes['path'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { path: 'requested', value: 2 },
    { path: 'fallback', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordContentIncompatibleRejection('requested');
  }).not.toThrow();
});

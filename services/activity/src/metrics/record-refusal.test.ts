import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordRefusal } from './record-refusal';

test('it counts refusals by code and reason', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRefusal('CHECKPOINT_INVALID', 'hash-mismatch');
  recordRefusal('CHECKPOINT_INVALID', 'hash-mismatch');
  recordRefusal('CONFLICT', 'stale-head');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.activity.refusal');

  const observed = dataPoints.map((dataPoint) => ({
    code: dataPoint.attributes['code'],
    reason: dataPoint.attributes['reason'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { code: 'CHECKPOINT_INVALID', reason: 'hash-mismatch', value: 2 },
    { code: 'CONFLICT', reason: 'stale-head', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRefusal('CONFLICT', 'stale-head');
  }).not.toThrow();
});

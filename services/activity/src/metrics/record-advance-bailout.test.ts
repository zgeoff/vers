import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordAdvanceBailout } from './record-advance-bailout';

test('it counts bailouts by reason', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordAdvanceBailout('conflict');
  recordAdvanceBailout('conflict');
  recordAdvanceBailout('chain_quarantined');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.activity.advance_bailouts');

  const observed = dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'conflict', value: 2 },
    { reason: 'chain_quarantined', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordAdvanceBailout('conflict');
  }).not.toThrow();
});

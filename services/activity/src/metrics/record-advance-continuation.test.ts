import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordAdvanceContinuation } from './record-advance-continuation';

test('it counts continuations by mint outcome', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordAdvanceContinuation('minted');
  recordAdvanceContinuation('minted');
  recordAdvanceContinuation('converged');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints(
    'vers.activity.advance_continuations',
  );

  const observed = dataPoints.map((dataPoint) => ({
    outcome: dataPoint.attributes['outcome'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { outcome: 'minted', value: 2 },
    { outcome: 'converged', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordAdvanceContinuation('minted');
  }).not.toThrow();
});

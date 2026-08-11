import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordTerminalTransition } from './record-terminal-transition';

test('it counts terminal transitions by status', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordTerminalTransition('stopped');
  recordTerminalTransition('stopped');
  recordTerminalTransition('capped');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints(
    'vers.activity.terminal_transitions',
  );

  const observed = dataPoints.map((dataPoint) => ({
    status: dataPoint.attributes['status'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { status: 'stopped', value: 2 },
    { status: 'capped', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordTerminalTransition('stopped');
  }).not.toThrow();
});

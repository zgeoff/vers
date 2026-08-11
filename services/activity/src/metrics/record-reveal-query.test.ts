import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordRevealQuery } from './record-reveal-query';

test('it records the revealed cell count', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealQuery({ cellCount: 19, sourceCount: 3 });

  const dataPoints = await inMemoryMetrics.readHistogramDataPoints('vers.activity.reveal_cells');

  expect(dataPoints.map((dataPoint) => dataPoint.sum)).toStrictEqual([19]);
});

test('it records the scanned first-clear grant source count', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealQuery({ cellCount: 19, sourceCount: 3 });

  const dataPoints = await inMemoryMetrics.readHistogramDataPoints('vers.activity.reveal_sources');

  expect(dataPoints.map((dataPoint) => dataPoint.sum)).toStrictEqual([3]);
});

test('it counts one observation per reveal query', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealQuery({ cellCount: 19, sourceCount: 3 });
  recordRevealQuery({ cellCount: 4, sourceCount: 1 });

  const dataPoints = await inMemoryMetrics.readHistogramDataPoints('vers.activity.reveal_cells');

  expect(dataPoints.map((dataPoint) => dataPoint.count)).toStrictEqual([2]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRevealQuery({ cellCount: 19, sourceCount: 3 });
  }).not.toThrow();
});

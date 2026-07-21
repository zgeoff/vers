import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  DataPointType,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import invariant from 'tiny-invariant';
import { recordBacklogClaimed } from './record-backlog-claimed';

function setupTest() {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);

  const provider = new MeterProvider({
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 })],
  });

  metrics.setGlobalMeterProvider(provider);

  onTestFinished(async () => {
    metrics.disable();

    await provider.shutdown();
  });

  return { exporter, provider };
}

test('it records one drain cycle backlog count', async () => {
  const ctx = setupTest();

  recordBacklogClaimed(4);

  await ctx.provider.forceFlush();

  const histogram = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.backlog_claimed');

  invariant(histogram?.dataPointType === DataPointType.HISTOGRAM, 'expected a histogram metric');

  expect(histogram.dataPoints[0]?.value.sum).toBe(4);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordBacklogClaimed(4);
  }).not.toThrow();
});

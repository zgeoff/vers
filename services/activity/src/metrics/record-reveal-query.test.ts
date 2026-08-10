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
import { recordRevealQuery } from './record-reveal-query';

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

test('it records the revealed cell count', async () => {
  const ctx = setupTest();

  recordRevealQuery(19, 3);

  await ctx.provider.forceFlush();

  const histogram = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.activity.reveal_cells');

  invariant(histogram?.dataPointType === DataPointType.HISTOGRAM, 'expected a histogram metric');

  expect(histogram.dataPoints[0]?.value.sum).toBe(19);
});

test('it records the scanned first-clear grant source count', async () => {
  const ctx = setupTest();

  recordRevealQuery(19, 3);

  await ctx.provider.forceFlush();

  const histogram = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.activity.reveal_sources');

  invariant(histogram?.dataPointType === DataPointType.HISTOGRAM, 'expected a histogram metric');

  expect(histogram.dataPoints[0]?.value.sum).toBe(3);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRevealQuery(19, 3);
  }).not.toThrow();
});

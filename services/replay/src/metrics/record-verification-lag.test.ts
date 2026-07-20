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
import { recordVerificationLag } from './record-verification-lag';

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

test('it records one verified append lag reading', async () => {
  const ctx = setupTest();

  recordVerificationLag(12.5);

  await ctx.provider.forceFlush();

  const histogram = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.verification_lag');

  invariant(histogram?.dataPointType === DataPointType.HISTOGRAM, 'expected a histogram metric');
  expect(histogram.dataPoints[0]?.value.sum).toBe(12.5);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordVerificationLag(12.5);
  }).not.toThrow();
});

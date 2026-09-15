import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordCacheLookup } from './record-cache-lookup';

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

test('it counts each lookup by what it found', async () => {
  const ctx = setupTest();

  recordCacheLookup('hit');
  recordCacheLookup('hit');
  recordCacheLookup('miss');
  recordCacheLookup('stale');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.cache_lookups');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    outcome: dataPoint.attributes['outcome'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { outcome: 'hit', value: 2 },
    { outcome: 'miss', value: 1 },
    { outcome: 'stale', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordCacheLookup('hit');
  }).not.toThrow();
});

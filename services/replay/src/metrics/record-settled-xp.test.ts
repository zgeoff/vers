import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordSettledXP } from './record-settled-xp';

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

test('it records settled xp split by how the amount was derived', async () => {
  const ctx = setupTest();

  recordSettledXP(40, 'progress');
  recordSettledXP(60, 'progress');
  recordSettledXP(215, 'terminal');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.settled_xp');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    source: dataPoint.attributes['source'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { source: 'progress', value: 100 },
    { source: 'terminal', value: 215 },
  ]);
});

test('it records a negative settlement, the shape a death penalty takes', async () => {
  const ctx = setupTest();

  recordSettledXP(-25, 'terminal');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.settled_xp');

  expect(counter?.dataPoints[0]?.value).toBe(-25);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordSettledXP(40, 'progress');
  }).not.toThrow();
});

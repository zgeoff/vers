import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordIterationFailure } from './record-iteration-failure';

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

test('it counts iteration failures by outcome', async () => {
  const ctx = setupTest();

  recordIterationFailure('errored');
  recordIterationFailure('errored');
  recordIterationFailure('quarantined');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.iteration_failures');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    outcome: dataPoint.attributes['outcome'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { outcome: 'errored', value: 2 },
    { outcome: 'quarantined', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordIterationFailure('errored');
  }).not.toThrow();
});

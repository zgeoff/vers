import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordReplayFlagRepair } from './record-replay-flag-repair';

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

test('it counts repaired chains by the direction of the repair', async () => {
  const ctx = setupTest();

  recordReplayFlagRepair('flagged', 3);
  recordReplayFlagRepair('cleared', 2);
  recordReplayFlagRepair('flagged', 1);

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.replay.flag_repairs');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    repair: dataPoint.attributes['repair'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { repair: 'cleared', value: 2 },
    { repair: 'flagged', value: 4 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordReplayFlagRepair('flagged', 1);
  }).not.toThrow();
});

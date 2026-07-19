import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordTerminalTransition } from './record-terminal-transition';

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

test('it counts terminal transitions by status', async () => {
  const ctx = setupTest();

  recordTerminalTransition('stopped');
  recordTerminalTransition('stopped');
  recordTerminalTransition('capped');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.activity.terminal_transitions');

  const observed = counter?.dataPoints.map((dataPoint) => ({
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

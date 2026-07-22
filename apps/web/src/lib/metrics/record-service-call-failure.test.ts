import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordServiceCallFailure } from './record-service-call-failure';

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

test('it counts service call failures by service and reason', async () => {
  const ctx = setupTest();

  recordServiceCallFailure('avatar', 'timeout');
  recordServiceCallFailure('avatar', 'timeout');
  recordServiceCallFailure('avatar', 'transport');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.web.service_call_failures');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    service: dataPoint.attributes['service'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'timeout', service: 'avatar', value: 2 },
    { reason: 'transport', service: 'avatar', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordServiceCallFailure('avatar', 'timeout');
  }).not.toThrow();
});

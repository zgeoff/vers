import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordServiceCallRetry } from './record-service-call-retry';

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

test('it counts retry attempts by service', async () => {
  const ctx = setupTest();

  recordServiceCallRetry('avatar');
  recordServiceCallRetry('avatar');
  recordServiceCallRetry('activity');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.web.service_call_retries');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    service: dataPoint.attributes['service'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { service: 'avatar', value: 2 },
    { service: 'activity', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordServiceCallRetry('avatar');
  }).not.toThrow();
});

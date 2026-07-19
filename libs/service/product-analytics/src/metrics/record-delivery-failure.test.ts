import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordDeliveryFailure } from './record-delivery-failure';

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

test('it counts delivery failures by reason', async () => {
  const ctx = setupTest();

  recordDeliveryFailure('rejected');
  recordDeliveryFailure('rejected');
  recordDeliveryFailure('quarantined');
  recordDeliveryFailure('unreachable');

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.analytics.delivery_failures');

  const observed = counter?.dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'rejected', value: 2 },
    { reason: 'quarantined', value: 1 },
    { reason: 'unreachable', value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordDeliveryFailure('rejected');
  }).not.toThrow();
});

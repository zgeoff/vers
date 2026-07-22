import { expect, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { recordAvatarNotActiveRejection } from './record-avatar-not-active-rejection';

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

test('it counts each avatar-not-active rejection', async () => {
  const ctx = setupTest();

  recordAvatarNotActiveRejection();
  recordAvatarNotActiveRejection();

  await ctx.provider.forceFlush();

  const counter = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .find((metric) => metric.descriptor.name === 'vers.activity.avatar_not_active_rejections');

  expect(counter?.dataPoints[0]?.value).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordAvatarNotActiveRejection();
  }).not.toThrow();
});

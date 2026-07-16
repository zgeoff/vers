import { expect, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { createTestDB } from '@vers/service-test-utils/bun';
import { sql } from 'kysely';
import pino from 'pino';
import { createActivityRow } from '../test-utils/create-activity-row';
import { registerVerificationMetrics } from './register-verification-metrics';

async function setupTest() {
  const handle = await createTestDB();

  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);

  const provider = new MeterProvider({
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 })],
  });

  metrics.setGlobalMeterProvider(provider);

  return {
    db: handle.db,
    exporter,
    provider,
    [Symbol.asyncDispose]: async () => {
      metrics.disable();

      await provider.shutdown();
      await handle[Symbol.asyncDispose]();
    },
  };
}

test('it observes the gauges from one database snapshot per collection', async () => {
  await using ctx = await setupTest();

  await createActivityRow(ctx.db, {
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 4,
    verifiedHead: 1,
  });

  await createActivityRow(ctx.db, { status: 'quarantined' });

  await createActivityRow(ctx.db, {
    appendedAt: new Date(),
    appendedHead: 2,
    simVersion: 'engine-a',
    status: 'parked',
    verifiedHead: 0,
  });

  registerVerificationMetrics({ db: ctx.db, logger: pino({ enabled: false }) });

  await ctx.provider.forceFlush();

  const collected = ctx.exporter
    .getMetrics()
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics);

  const lag = collected.find((metric) => metric.descriptor.name === 'vers.verification.lag');

  const headDelta = collected.find(
    (metric) => metric.descriptor.name === 'vers.verification.head_delta.p95',
  );

  const quarantined = collected.find(
    (metric) => metric.descriptor.name === 'vers.verification.quarantined',
  );

  const parked = collected.find((metric) => metric.descriptor.name === 'vers.verification.parked');

  expect(lag?.dataPoints[0]?.value).toBeWithin(50, 90);
  expect(headDelta?.dataPoints[0]?.value).toBeWithin(2.9, 3);
  expect(quarantined?.dataPoints[0]?.value).toBe(1);

  expect(parked?.dataPoints[0]).toMatchObject({
    attributes: { sim_version: 'engine-a' },
    value: 1,
  });
});

test('it logs a snapshot failure instead of throwing out of the collection', async () => {
  await using ctx = await setupTest();

  const lines: Array<string> = [];

  const logger = pino(
    { level: 'error' },
    {
      write: (line: string) => {
        lines.push(line);
      },
    },
  );

  registerVerificationMetrics({ db: ctx.db, logger });

  await sql`drop table activities cascade`.execute(ctx.db);

  await expect(ctx.provider.forceFlush()).toResolve();

  expect(lines.join('')).toInclude('verification metrics snapshot failed');
});

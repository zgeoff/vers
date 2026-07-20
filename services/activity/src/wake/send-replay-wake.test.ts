import { expect, mock, onTestFinished, test } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { mockReplayService } from '@vers/mock-services/replay';
import { waitFor } from '@vers/test-utils';
import { server } from '../mocks/server';
import { sendReplayWake } from './send-replay-wake';

/**
 * The module-level coalesce window persists across every test in this process — waiting it out
 * first guarantees a call this test makes is never silently absorbed by a window a previous test
 * left active.
 */
async function waitOutCoalesceWindow(): Promise<void> {
  await Bun.sleep(1100);
}

function setupMetricsTest() {
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

test('it never throws into the caller', async () => {
  await waitOutCoalesceWindow();

  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  expect(() => {
    sendReplayWake();
  }).not.toThrow();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );
});

test('it coalesces rapid calls into a single delivery', async () => {
  await waitOutCoalesceWindow();

  const wakeHandler = mock(() => ({ drained: 0 }));

  server.use(mockReplayService.wake.handler(wakeHandler));

  sendReplayWake();
  sendReplayWake();
  sendReplayWake();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 2000 },
  );

  // gives a wrongly-scheduled second delivery time to land before the assertion below
  await Bun.sleep(300);

  expect(wakeHandler).toHaveBeenCalledOnce();
});

test('it keeps a single delivery in flight when one outlasts the coalesce window', async () => {
  await waitOutCoalesceWindow();

  const wakeHandler = mock(async () => {
    await Bun.sleep(1500);

    return { drained: 0 };
  });

  server.use(mockReplayService.wake.handler(wakeHandler));

  sendReplayWake();

  // the coalesce window has lapsed but the first delivery is still awaiting the slow handler, so
  // this second call must join it rather than open a concurrent delivery
  await Bun.sleep(1100);

  sendReplayWake();

  await waitFor(
    () => {
      expect(wakeHandler).toHaveBeenCalledOnce();
    },
    { timeoutMs: 3000 },
  );

  // outlast the slow handler so a second delivery, had one started, would have landed by now
  await Bun.sleep(700);

  expect(wakeHandler).toHaveBeenCalledOnce();
});

test('it retries a failed delivery then records the poke-failure counter', async () => {
  await waitOutCoalesceWindow();

  const metricsCtx = setupMetricsTest();

  const wakeHandler = mock(() => {
    throw new Error('simulated wake delivery failure');
  });

  server.use(mockReplayService.wake.handler(wakeHandler));

  sendReplayWake();

  await waitFor(
    async () => {
      await metricsCtx.provider.forceFlush();

      const counter = metricsCtx.exporter
        .getMetrics()
        .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
        .flatMap((scopeMetrics) => scopeMetrics.metrics)
        .find((metric) => metric.descriptor.name === 'vers.activity.replay_poke_failed');

      expect(counter?.dataPoints[0]?.value).toBe(1);
    },
    { timeoutMs: 3000 },
  );

  expect(wakeHandler).toHaveBeenCalledTimes(3);
});

test('it aborts a hung attempt and records the poke-failure counter after exhausting retries', async () => {
  await waitOutCoalesceWindow();

  const metricsCtx = setupMetricsTest();
  const wakeHandler = mock(() => new Promise<{ drained: number }>(() => {}));

  server.use(mockReplayService.wake.handler(wakeHandler));

  sendReplayWake();

  await waitFor(
    async () => {
      await metricsCtx.provider.forceFlush();

      const counter = metricsCtx.exporter
        .getMetrics()
        .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
        .flatMap((scopeMetrics) => scopeMetrics.metrics)
        .find((metric) => metric.descriptor.name === 'vers.activity.replay_poke_failed');

      expect(counter?.dataPoints[0]?.value).toBe(1);
    },
    { timeoutMs: 12_000 },
  );

  expect(wakeHandler).toHaveBeenCalledTimes(3);
}, 15_000);

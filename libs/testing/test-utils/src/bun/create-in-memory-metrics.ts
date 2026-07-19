import { onTestFinished } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

interface InMemoryMetrics {
  /**
   * Flushes the reader and returns the latest cumulative value of the named counter, or undefined
   * when nothing has recorded it in this test.
   */
  readonly readCounterValue: (name: string) => Promise<number | undefined>;
}

/**
 * Registers an in-memory OTel meter provider as the process-global provider for the current test,
 * so code resolving instruments through the global metrics API records into it, and tears it down
 * when the test finishes. The export interval is effectively infinite — `readCounterValue` forces a
 * flush on demand rather than waiting on a periodic reader.
 */
export function createInMemoryMetrics(): InMemoryMetrics {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);

  const provider = new MeterProvider({
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 })],
  });

  metrics.setGlobalMeterProvider(provider);

  onTestFinished(async () => {
    metrics.disable();

    await provider.shutdown();
  });

  return {
    async readCounterValue(name) {
      await provider.forceFlush();

      const value = exporter
        .getMetrics()
        .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
        .flatMap((scopeMetrics) => scopeMetrics.metrics)
        .find((metric) => metric.descriptor.name === name)?.dataPoints[0]?.value;

      return typeof value === 'number' ? value : undefined;
    },
  };
}

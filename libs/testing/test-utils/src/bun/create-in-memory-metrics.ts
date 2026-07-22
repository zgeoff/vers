import { onTestFinished } from 'bun:test';
import type { Attributes } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  DataPointType,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

interface InMemoryMetrics {
  /**
   * Flushes the reader and returns the named counter's data points, one per distinct attribute
   * combination recorded in this test.
   */
  readonly readCounterDataPoints: (name: string) => Promise<ReadonlyArray<CounterDataPoint>>;

  /**
   * Flushes the reader and returns the latest cumulative value of the named counter, or undefined
   * when nothing has recorded it in this test.
   */
  readonly readCounterValue: (name: string) => Promise<number | undefined>;
}

interface CounterDataPoint {
  readonly attributes: Attributes;
  readonly value: number;
}

/**
 * Registers an in-memory OTel meter provider as the process-global provider for the current test,
 * so code resolving instruments through the global metrics API records into it, and tears it down
 * when the test finishes. The export interval is effectively infinite — the readers force a flush
 * on demand rather than waiting on a periodic reader.
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

  const readCounterDataPoints = async (name: string): Promise<ReadonlyArray<CounterDataPoint>> => {
    await provider.forceFlush();

    const metric = exporter
      .getMetrics()
      .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
      .flatMap((scopeMetrics) => scopeMetrics.metrics)
      .find((candidate) => candidate.descriptor.name === name);

    if (metric === undefined || metric.dataPointType !== DataPointType.SUM) {
      return [];
    }

    return metric.dataPoints.map((dataPoint) => ({
      attributes: dataPoint.attributes,
      value: dataPoint.value,
    }));
  };

  return {
    readCounterDataPoints,
    async readCounterValue(name) {
      const dataPoints = await readCounterDataPoints(name);

      return dataPoints[0]?.value;
    },
  };
}
